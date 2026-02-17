import { app, BrowserWindow, protocol, Menu } from "electron";
import fs from "node:fs";
import path from "node:path";
import { registerHandlers } from "./ipc/handlers";

app.commandLine.appendSwitch("disable-features", "OutOfBlinkCors"); // opcional dev

const isDev = !app.isPackaged;

let mainWin: BrowserWindow | null = null;

function registerAppFileProtocol() {
    protocol.handle("appfile", async (request: Request) => {
        try {
            const url = new URL(request.url);
            // Ex.: appfile://audio?path=...
            const encoded = url.searchParams.get("path");
            if (!encoded) return new Response("Missing path", { status: 400 });

            // base64url -> string
            const absPath = Buffer.from(encoded, "base64url").toString("utf8");

            // Segurança básica
            if (!fs.existsSync(absPath)) return new Response("Not found", { status: 404 });
            const st = fs.statSync(absPath);
            if (!st.isFile()) return new Response("Not a file", { status: 400 });

            const ext = path.extname(absPath).toLowerCase();
            const allowed = new Set([".mp3", ".wav", ".m4a", ".aac", ".ogg", ".flac"]);
            if (!allowed.has(ext)) return new Response("Unsupported", { status: 415 });

            // Conteúdo
            const data = await fs.promises.readFile(absPath);

            // MIME (mínimo necessário pro <audio>)
            const mime =
                ext === ".mp3" ? "audio/mpeg" :
                    ext === ".wav" ? "audio/wav" :
                        ext === ".m4a" ? "audio/mp4" :
                            ext === ".aac" ? "audio/aac" :
                                ext === ".ogg" ? "audio/ogg" :
                                    ext === ".flac" ? "audio/flac" :
                                        "application/octet-stream";

            return new Response(data, {
                status: 200,
                headers: {
                    "Content-Type": mime,
                    "Content-Length": String(data.byteLength),
                    "Accept-Ranges": "bytes"
                }
            });
        } catch {
            return new Response("Bad request", { status: 400 });
        }
    });
}

function createWindow() {
    mainWin = new BrowserWindow({
        width: 1200,
        height: 760,
        minWidth: 1080,
        minHeight: 700,
        frame: false,
        titleBarStyle: "hidden",
        backgroundColor: "#0b1220",
        webPreferences: {
            preload: path.join(__dirname, "preload.js"),
            contextIsolation: true,
            sandbox: false,
            nodeIntegration: false,
            devTools: true
        }
    });

    Menu.setApplicationMenu(null);

    if (isDev) {
        mainWin.loadURL("http://127.0.0.1:5173");
        // mainWin.webContents.openDevTools({ mode: "detach" });
    } else {
        // __dirname = dist-electron/electron
        mainWin.loadFile(path.join(__dirname, "..", "..", "dist", "index.html"));
    }

    registerHandlers(() => mainWin!);
}

app.whenReady().then(() => {
    registerAppFileProtocol();
    createWindow();
    app.on("activate", () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
});
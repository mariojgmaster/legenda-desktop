import { app, BrowserWindow, protocol, Menu, Tray, nativeImage } from "electron";
import fs from "node:fs";
import path from "node:path";
import { registerHandlers } from "./ipc/handlers";

app.commandLine.appendSwitch("disable-features", "OutOfBlinkCors"); // opcional dev

const isDev = !app.isPackaged;

let mainWin: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;

function safeFallbackHtml(title: string, message: string) {
    const escapedMessage = message.replace(/</g, "&lt;").replace(/>/g, "&gt;");
    return `data:text/html,<!doctype html><html lang="pt-BR"><head><meta charset="UTF-8"/><title>${title}</title><style>body{margin:0;font-family:Segoe UI,Arial,sans-serif;background:#0b1220;color:#e2e8f0;display:grid;place-items:center;min-height:100vh;padding:20px}.card{max-width:760px;background:#111827;border:1px solid #334155;border-radius:14px;padding:18px}h1{margin:0 0 10px;font-size:22px}p{margin:8px 0;line-height:1.5;color:#cbd5e1}pre{white-space:pre-wrap;background:#0f172a;padding:10px;border-radius:10px;border:1px solid #334155}</style></head><body><div class="card"><h1>${title}</h1><p>O app encontrou um problema ao iniciar, mas você pode tentar novamente.</p><pre>${escapedMessage}</pre></div></body></html>`;
}

function getTrayIcon() {
    try {
        const image = nativeImage.createFromPath(process.execPath);
        if (!image.isEmpty()) return image;
    } catch { }
    return nativeImage.createEmpty();
}

function showMainWindow() {
    if (!mainWin || mainWin.isDestroyed()) return;
    if (mainWin.isMinimized()) mainWin.restore();
    mainWin.show();
    mainWin.focus();
}

function hideMainWindow() {
    if (!mainWin || mainWin.isDestroyed()) return;
    mainWin.hide();
}

function createTray() {
    if (tray) return;

    tray = new Tray(getTrayIcon());
    tray.setToolTip("Legenda Desktop");

    const buildMenu = () => Menu.buildFromTemplate([
        { label: "Abrir", click: () => showMainWindow() },
        { label: "Ocultar", click: () => hideMainWindow() },
        { type: "separator" },
        { label: "Recarregar interface", click: () => mainWin?.webContents.reload() },
        { type: "separator" },
        {
            label: "Sair",
            click: () => {
                isQuitting = true;
                app.quit();
            }
        }
    ]);

    tray.setContextMenu(buildMenu());
    tray.on("double-click", () => showMainWindow());
}

function registerAppFileProtocol() {
    protocol.handle("appfile", async (request: Request) => {
        try {
            const url = new URL(request.url);
            const encoded = url.searchParams.get("path");
            if (!encoded) return new Response("Missing path", { status: 400 });

            const absPath = Buffer.from(encoded, "base64url").toString("utf8");

            if (!fs.existsSync(absPath)) return new Response("Not found", { status: 404 });
            const st = fs.statSync(absPath);
            if (!st.isFile()) return new Response("Not a file", { status: 400 });

            const ext = path.extname(absPath).toLowerCase();
            const allowed = new Set([".mp3", ".wav", ".m4a", ".aac", ".ogg", ".flac"]);
            if (!allowed.has(ext)) return new Response("Unsupported", { status: 415 });

            const data = await fs.promises.readFile(absPath);

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

    mainWin.on("close", (event) => {
        if (isQuitting) return;
        event.preventDefault();
        mainWin?.hide();
    });

    if (isDev) {
        mainWin.loadURL("http://127.0.0.1:5173");
    } else {
        mainWin.loadFile(path.join(__dirname, "..", "..", "dist", "index.html"));
    }

    mainWin.webContents.on("render-process-gone", (_event, details) => {
        console.error("[electron] render-process-gone", details);
        mainWin?.loadURL(safeFallbackHtml("Falha ao renderizar interface", JSON.stringify(details)));
    });

    mainWin.webContents.on("did-fail-load", (_event, code, desc) => {
        if (code === -3) return;
        console.error("[electron] did-fail-load", code, desc);
        mainWin?.loadURL(safeFallbackHtml("Falha ao carregar a interface", `Código: ${code}\n${desc}`));
    });

    registerHandlers(() => mainWin!);
}

app.whenReady().then(() => {
    registerAppFileProtocol();
    createWindow();
    createTray();

    app.on("activate", () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
        showMainWindow();
    });
});

app.on("before-quit", () => {
    isQuitting = true;
});

app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
});

process.on("uncaughtException", (error) => {
    console.error("[electron] uncaughtException", error);
});

process.on("unhandledRejection", (reason) => {
    console.error("[electron] unhandledRejection", reason);
});

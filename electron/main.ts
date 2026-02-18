import { app, BrowserWindow, protocol, Menu } from "electron";
import fs from "node:fs";
import path from "node:path";
import { registerHandlers } from "./ipc/handlers";
import { ensureDir, WhisperPaths } from "./infra/whisper/WhisperPaths"; // 👈 ADD

app.commandLine.appendSwitch("disable-features", "OutOfBlinkCors"); // opcional dev

const isDev = !app.isPackaged;

let mainWin: BrowserWindow | null = null;

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

// ✅ NOVO: garante que os modelos bundled existam em userData/models
function ensureBundledModelsInstalled() {
    const destDir = WhisperPaths.modelsDir(); // já garante dir
    const srcDir = app.isPackaged
        ? path.join(process.resourcesPath, "models")
        : path.join(process.cwd(), "electron", "assets", "models");

    const modelFiles = [
        "ggml-tiny.bin",
        "ggml-base.bin",
        "ggml-small.bin",
        "ggml-medium.bin",
    ];

    // Se não existir (pack mal configurado), não quebra o app inteiro: loga e segue.
    if (!fs.existsSync(srcDir)) {
        console.warn("[models] srcDir não encontrado:", srcDir);
        return;
    }

    ensureDir(destDir);

    for (const file of modelFiles) {
        const src = path.join(srcDir, file);
        const dst = path.join(destDir, file);

        if (fs.existsSync(dst)) continue; // não sobrescreve

        if (!fs.existsSync(src)) {
            console.warn("[models] arquivo não encontrado no bundle:", src);
            continue;
        }

        try {
            fs.copyFileSync(src, dst);
            console.log("[models] instalado:", file);
        } catch (e: any) {
            console.warn("[models] falha ao copiar:", file, e?.message || e);
        }
    }
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
        mainWin?.loadURL(safeFallbackHtml("Falha ao carregar a interface", `Código: ${code}
${desc}`));
    });

    registerHandlers(() => mainWin!);
}

app.whenReady().then(() => {
    registerAppFileProtocol();

    // ✅ aqui é o ponto correto: app pronto, userData pronto
    ensureBundledModelsInstalled();

    createWindow();

    app.on("activate", () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
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

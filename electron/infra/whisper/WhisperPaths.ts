import path from "node:path";
import fs from "node:fs";
import { app } from "electron";

export function ensureDir(p: string) {
    if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

/**
 * Resolve paths de forma estável:
 * - DEV: usa a raiz do projeto (process.cwd()) -> electron/assets/...
 * - PACKAGED: usa process.resourcesPath -> resources/whisper/...
 */
function resolveBinDir() {
    if (app.isPackaged) {
        // Em produção você vai empacotar o binário em resources/whisper/win
        return path.join(process.resourcesPath, "whisper", "win");
    }

    // Em dev, normalmente o cwd é a raiz do projeto (onde está package.json)
    return path.join(process.cwd(), "electron", "assets", "whisper", "win");
}

export const WhisperPaths = {
    binDir: resolveBinDir(),
    bin: path.join(resolveBinDir(), "whisper-cli.exe"),

    modelsDir() {
        const p = path.join(app.getPath("userData"), "models");
        ensureDir(p);
        return p;
    },

    tempDir() {
        const p = path.join(app.getPath("userData"), "tmp");
        ensureDir(p);
        return p;
    }
};
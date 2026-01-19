import { spawn, ChildProcessWithoutNullStreams } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

import { WhisperPaths, ensureDir } from "./WhisperPaths";
import type { WhisperRunOptions } from "./types";

export type WhisperRunResult = {
    srtPath: string;
    stdout: string;
    stderr: string;
    jobDir: string;
};

const GRANULARITY_PRESETS = {
    LOW: { maxLen: 0, splitOnWord: false }, // mais “denso”
    MEDIUM: { maxLen: 42, splitOnWord: true },
    HIGH: { maxLen: 28, splitOnWord: true },
    ULTRA: { maxLen: 18, splitOnWord: true }, // mais “picado”
} as const;

type OnLog = (line: string) => void;

export class WhisperRunner {
    private process: ChildProcessWithoutNullStreams | null = null;

    async run(opts: WhisperRunOptions, onLog?: OnLog): Promise<WhisperRunResult> {
        console.log("[whisper] bin =", WhisperPaths.bin);
        console.log("[whisper] binDir =", WhisperPaths.binDir);

        // validações básicas
        if (!fs.existsSync(WhisperPaths.bin)) {
            throw new Error("Binário do Whisper (whisper-cli.exe) não encontrado.");
        }
        if (!fs.existsSync(opts.audioPath)) {
            throw new Error("Arquivo de áudio não encontrado.");
        }
        if (opts.signal?.aborted) {
            throw new Error("Job cancelado antes de iniciar.");
        }

        const modelPath = path.join(WhisperPaths.modelsDir(), `ggml-${opts.model}.bin`);
        if (!fs.existsSync(modelPath)) {
            throw new Error(`Modelo '${opts.model}' não encontrado em: ${modelPath}`);
        }

        // job temp dir único
        const jobKey = crypto.randomBytes(8).toString("hex");
        const jobDir = path.join(WhisperPaths.tempDir(), `job-${jobKey}`);
        ensureDir(jobDir);

        // baseName do áudio (sem extensão)
        const baseName = path.parse(opts.audioPath).name;

        // IMPORTANTÍSSIMO:
        // --output-file (ou -of) recebe o *caminho base*, sem extensão.
        // O whisper vai criar: <outBase>.srt quando --output-srt estiver ativo.
        const outBase = path.join(jobDir, baseName);
        const expectedSrt = `${outBase}.srt`;

        const presetKey =
            (opts.granularity && opts.granularity in GRANULARITY_PRESETS
                ? opts.granularity
                : "MEDIUM") as keyof typeof GRANULARITY_PRESETS;

        const g = GRANULARITY_PRESETS[presetKey];


        const args = [
            "-m", modelPath,
            "-f", opts.audioPath,
            "-l", opts.language,
            "--output-srt",
            "--output-file", outBase,
            "--print-progress",
        ];

        if (g.maxLen && g.maxLen > 0) {
            args.push("-ml", String(g.maxLen));
        }
        if (g.splitOnWord) {
            args.push("--split-on-word");
        }

        console.log("[whisper] model =", modelPath);
        console.log("[whisper] audio =", opts.audioPath);
        console.log("[whisper] jobDir =", jobDir);
        console.log("[whisper] outBase =", outBase);

        return await this.spawnOnce(args, expectedSrt, jobDir, onLog, opts.signal);
    }

    cancel() {
        if (this.process) {
            try {
                this.process.kill();
            } catch { }
            this.process = null;
        }
    }

    private spawnOnce(
        args: string[],
        expectedSrt: string,
        jobDir: string,
        onLog?: OnLog,
        signal?: AbortSignal
    ): Promise<WhisperRunResult> {
        return new Promise((resolve, reject) => {
            let stdout = "";
            let stderr = "";

            console.log("[whisper] cmd =", `"${WhisperPaths.bin}" ${args.map(a => JSON.stringify(a)).join(" ")}`);

            // ⚠️ Windows: muitas vezes o exe depende de DLLs na mesma pasta do binário.
            // Então mantemos cwd = binDir para garantir resolução de DLL.
            this.process = spawn(WhisperPaths.bin, args, {
                cwd: WhisperPaths.binDir,
                windowsHide: true,
            });

            const proc = this.process;

            const abort = () => {
                try { proc.kill("SIGTERM"); } catch { }
                setTimeout(() => {
                    try { proc.kill("SIGKILL"); } catch { }
                }, 2000);
            };

            if (signal) {
                if (signal.aborted) abort();
                signal.addEventListener("abort", abort, { once: true });
            }

            proc.stdout.on("data", (d) => {
                const s = d.toString();
                stdout += s;
                onLog?.(s);
            });

            proc.stderr.on("data", (d) => {
                const s = d.toString();
                stderr += s;
                onLog?.(s);
            });

            proc.on("error", (err) => reject(err));

            proc.on("close", (code) => {
                this.process = null;

                if (signal) {
                    try {
                        signal.removeEventListener("abort", abort);
                    } catch { }
                }

                // code pode vir null em alguns cenários raros
                if (code !== 0) {
                    // 3221225781 é clássico de dependência/DLL faltando / crash nativo no Windows
                    const hint =
                        code === 3221225781
                            ? "\nDica: esse código costuma indicar DLL faltando/crash nativo. Verifique se whisper.dll/SDL2.dll/ggml*.dll estão junto do whisper-cli.exe."
                            : "";
                    return reject(new Error(`Whisper falhou (code ${code}).${hint}\n${stderr || stdout}`));
                }

                // valida saída
                if (!fs.existsSync(expectedSrt)) {
                    const listing = fs.existsSync(jobDir) ? fs.readdirSync(jobDir).join(", ") : "(jobDir missing)";
                    return reject(
                        new Error(
                            `Whisper concluiu, mas não gerou SRT esperado: ${expectedSrt}\nArquivos no jobDir: ${listing}\n${stderr || stdout}`
                        )
                    );
                }

                // resolve({ srtPath: expectedSrt, stdout, stderr });
                resolve({ srtPath: expectedSrt, stdout, stderr, jobDir });
            });
        });
    }
}
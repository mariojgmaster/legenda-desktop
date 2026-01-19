import { WhisperRunner } from "../../infra/whisper/WhisperRunner";
import type { WhisperRunOptions } from "../../infra/whisper/types";

type ProgressFn = (evt: {
    jobId: string;
    step: "PREPARING" | "TRANSCRIBING" | "CONVERTING" | "SAVING" | "DONE" | "ERROR";
    message?: string;
}) => void;

export class JobController {
    private runners = new Map<string, WhisperRunner>();

    async start(jobId: string, input: WhisperRunOptions, progress: ProgressFn) {
        const runner = new WhisperRunner();
        this.runners.set(jobId, runner);

        try {
            progress({ jobId, step: "PREPARING", message: "Validando arquivos e modelo..." });

            progress({ jobId, step: "TRANSCRIBING", message: "Transcrevendo áudio..." });

            const res = await runner.run(input, (line) => {
                // se quiser, dá pra mapear logs em mensagens curtas
                // progress({ jobId, step: "TRANSCRIBING", message: "..." })
            });

            // Na Fase 2, consideramos "CONVERTING/SAVING" como ainda não implementado.
            // Vamos só sinalizar DONE e devolver caminho do SRT na Fase 3 via IPC.
            progress({ jobId, step: "DONE", message: "Transcrição concluída (SRT gerado)." });

            return res; // contém srtPath
        } catch (e: any) {
            progress({ jobId, step: "ERROR", message: e?.message || "Falha na transcrição." });
            throw e;
        } finally {
            this.runners.delete(jobId);
        }
    }

    cancel(jobId: string) {
        const r = this.runners.get(jobId);
        if (r) {
            r.cancel();
            this.runners.delete(jobId);
        }
    }
}
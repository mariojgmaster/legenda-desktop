import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { GranularityPreset, LanguageCode, ModelId, SubtitleFormat } from "../../shared/ipc/dtos";

type StepKey = "IDLE" | "PREPARING" | "TRANSCRIBING" | "CONVERTING" | "SAVING" | "DONE" | "ERROR";

type AudioFile = { path: string; name: string };
type PreviewItem = { index: number; startMs: number; endMs: number; text: string };

type ControllerOptions = {
    audios: AudioFile[];
    activeAudioPath: string;
    outputPath: string;
    outputDir: string;
    language: LanguageCode;
    modelId: ModelId;
    format: SubtitleFormat;
    granularity: GranularityPreset;
    assKaraoke: boolean;
    onGeneratedRefresh: (selectId?: string) => Promise<void>;
};

export function useTranscriptionController(opts: ControllerOptions) {
    const [busy, setBusy] = useState(false);
    const [step, setStep] = useState<StepKey>("IDLE");
    const [message, setMessage] = useState("");
    const [currentJobId, setCurrentJobId] = useState("");
    const [batchQueue, setBatchQueue] = useState<string[]>([]);
    const [preview, setPreview] = useState<PreviewItem[]>([]);

    const optionsRef = useRef(opts);
    useEffect(() => {
        optionsRef.current = opts;
    }, [opts]);

    const activeAudio = useMemo(() => {
        if (opts.audios.length === 0) return null;
        return opts.audios.find((a) => a.path === opts.activeAudioPath) || opts.audios[0];
    }, [opts.audios, opts.activeAudioPath]);

    const buildJobReq = useCallback((audioPath: string) => {
        const current = optionsRef.current;
        return {
            audioPath,
            outputPath: current.outputPath || undefined,
            outputDir: current.outputDir || undefined,
            language: current.language,
            modelId: current.modelId,
            format: current.format,
            granularity: current.granularity,
            assKaraoke: current.assKaraoke
        };
    }, []);

    const runNextFromQueue = useCallback(async () => {
        const current = optionsRef.current;
        if (batchQueue.length === 0) {
            setBusy(false);
            setCurrentJobId("");
            setStep("DONE");
            setMessage("Concluído.");
            return;
        }

        const [nextPath, ...rest] = batchQueue;
        setBatchQueue(rest);

        const nextAudio = current.audios.find((a) => a.path === nextPath);
        if (!nextAudio) {
            await runNextFromQueue();
            return;
        }

        setMessage(`Processando próximo arquivo (${rest.length + 1} restante)...`);
        const started = await window.api.startJob(buildJobReq(nextAudio.path));
        setCurrentJobId(started.jobId);
    }, [batchQueue, buildJobReq]);

    useEffect(() => {
        const off1 = window.api.onJobProgress((e) => {
            setStep((e.step as StepKey) ?? "IDLE");
            setMessage(e.message || "");
        });

        const off2 = window.api.onJobDone(async (e) => {
            setPreview(e.preview.map((p) => ({ index: p.index, startMs: p.startMs, endMs: p.endMs, text: p.text })));
            await optionsRef.current.onGeneratedRefresh(e.generated.id);
            await runNextFromQueue();
        });

        const off3 = window.api.onJobError((e) => {
            setBusy(false);
            setCurrentJobId("");
            setBatchQueue([]);
            setStep("ERROR");
            setMessage(e.error.message || "Erro.");
        });

        return () => {
            off1();
            off2();
            off3();
        };
    }, [runNextFromQueue]);

    const start = useCallback(async () => {
        const current = optionsRef.current;
        if (current.audios.length === 0) return;

        const currentActive = current.audios.find((a) => a.path === current.activeAudioPath) || current.audios[0];
        const batch = current.audios.length === 1 ? [currentActive] : current.audios;

        setBusy(true);
        setPreview([]);
        setStep("PREPARING");
        setMessage(batch.length > 1 ? `Iniciando lote (${batch.length} arquivos)...` : "Iniciando...");

        const [first, ...rest] = batch;
        const started = await window.api.startJob(buildJobReq(first.path));
        setCurrentJobId(started.jobId);
        setBatchQueue(rest.map((x) => x.path));
    }, [buildJobReq]);

    const cancelCurrentJob = useCallback(async () => {
        if (!currentJobId) return;
        await window.api.cancelJob({ jobId: currentJobId });
        setBusy(false);
        setCurrentJobId("");
        setBatchQueue([]);
        setStep("IDLE");
        setMessage("Processamento cancelado pelo usuário.");
    }, [currentJobId]);

    const progressPercent = useMemo(() => {
        if (step === "DONE") return 100;
        if (step === "SAVING") return 95;
        if (step === "CONVERTING") return 82;
        if (step === "TRANSCRIBING") return 58;
        if (step === "PREPARING") return 18;
        return 0;
    }, [step]);

    return {
        activeAudio,
        busy,
        step,
        message,
        currentJobId,
        batchQueue,
        preview,
        progressPercent,
        setMessage,
        setStep,
        setPreview,
        start,
        cancelCurrentJob,
        setBatchQueue
    };
}

export type { StepKey, PreviewItem };

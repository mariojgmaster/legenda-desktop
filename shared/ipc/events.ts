import type { AppErrorDTO } from "./errors";
import type { ModelId, SegmentPreviewDTO } from "./dtos";

export type JobStep = "PREPARING" | "TRANSCRIBING" | "CONVERTING" | "SAVING" | "DONE";

export type JobProgressEvent = {
    jobId: string;
    step: JobStep;
    message?: string;
};

export type JobDoneEvent = {
    jobId: string;
    generated: { id: string; path: string; fileName: string };
    preview: SegmentPreviewDTO[];
};

export type JobErrorEvent = { jobId: string; error: AppErrorDTO };

export type ModelsDownloadProgressEvent = {
    modelId: ModelId;
    downloadedBytes: number;
    totalBytes?: number;
};

export type GeneratedFilesChangedEvent = {
    reason: "CREATED" | "RENAMED" | "DELETED" | "REFRESH";
};
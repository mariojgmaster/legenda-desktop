export type WhisperLanguage =
    | "pt"
    | "en"
    | "es"
    | "fr"
    | "de"
    | "it";

export type WhisperModel =
    | "tiny"
    | "base"
    | "small"
    | "medium";

import type { GranularityPreset } from "../../../shared/ipc/dtos";

export type WhisperRunOptions = {
    audioPath: string;
    language: WhisperLanguage;
    model: WhisperModel;
    signal?: AbortSignal;
    granularity?: GranularityPreset;
};
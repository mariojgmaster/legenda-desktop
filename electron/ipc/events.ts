import type { BrowserWindow } from "electron";
import { IPC } from "./channels";
import type {
    JobDoneEvent,
    JobErrorEvent,
    JobProgressEvent,
    ModelsDownloadProgressEvent,
    GeneratedFilesChangedEvent
} from "../../shared/ipc/events";

export function emitJobProgress(win: BrowserWindow, payload: JobProgressEvent) {
    win.webContents.send(IPC.EVT_JOB_PROGRESS, payload);
}
export function emitJobDone(win: BrowserWindow, payload: JobDoneEvent) {
    win.webContents.send(IPC.EVT_JOB_DONE, payload);
}
export function emitJobError(win: BrowserWindow, payload: JobErrorEvent) {
    win.webContents.send(IPC.EVT_JOB_ERROR, payload);
}
export function emitModelProgress(win: BrowserWindow, payload: ModelsDownloadProgressEvent) {
    win.webContents.send(IPC.EVT_MODEL_DL_PROGRESS, payload);
}
export function emitGeneratedChanged(win: BrowserWindow, payload: GeneratedFilesChangedEvent) {
    win.webContents.send(IPC.EVT_GENERATED_CHANGED, payload);
}
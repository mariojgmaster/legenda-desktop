import { contextBridge, ipcRenderer } from "electron";
import { IPC } from "./ipc/channels";

import type {
    ChooseOutputPathRequest,
    DownloadModelRequest,
    RemoveModelRequest,
    RenameGeneratedFileRequest,
    DeleteGeneratedFileRequest,
    OpenGeneratedFileRequest,
    ShowInFolderRequest,
    StartJobRequest
} from "../shared/ipc/dtos";

contextBridge.exposeInMainWorld("api", {
    pickAudio: () => ipcRenderer.invoke(IPC.PICK_AUDIO),
    chooseOutputPath: (req: ChooseOutputPathRequest) => ipcRenderer.invoke(IPC.CHOOSE_OUTPUT, req),

    listModels: () => ipcRenderer.invoke(IPC.LIST_MODELS),
    downloadModel: (req: DownloadModelRequest) => ipcRenderer.invoke(IPC.DOWNLOAD_MODEL, req),
    removeModel: (req: RemoveModelRequest) => ipcRenderer.invoke(IPC.REMOVE_MODEL, req),

    startJob: (req: StartJobRequest) => ipcRenderer.invoke(IPC.JOB_START, req),
    cancelJob: (req: { jobId: string }) => ipcRenderer.invoke(IPC.JOB_CANCEL, req),

    listGeneratedFiles: () => ipcRenderer.invoke(IPC.GENERATED_LIST),
    renameGeneratedFile: (req: RenameGeneratedFileRequest) => ipcRenderer.invoke(IPC.GENERATED_RENAME, req),
    deleteGeneratedFile: (req: DeleteGeneratedFileRequest) => ipcRenderer.invoke(IPC.GENERATED_DELETE, req),
    openGeneratedFile: (req: OpenGeneratedFileRequest) => ipcRenderer.invoke(IPC.GENERATED_OPEN, req),
    showInFolder: (req: ShowInFolderRequest) => ipcRenderer.invoke(IPC.GENERATED_SHOW_IN_FOLDER, req),

    onJobProgress: (cb: any) => on(IPC.EVT_JOB_PROGRESS, cb),
    onJobDone: (cb: any) => on(IPC.EVT_JOB_DONE, cb),
    onJobError: (cb: any) => on(IPC.EVT_JOB_ERROR, cb),
    onModelDownloadProgress: (cb: any) => on(IPC.EVT_MODEL_DL_PROGRESS, cb),
    onGeneratedChanged: (cb: any) => on(IPC.EVT_GENERATED_CHANGED, cb),

    getFileUrl: (absPath: string) => ipcRenderer.invoke(IPC.GET_FILE_URL, { absPath }),

    windowMinimize: () => ipcRenderer.invoke(IPC.WINDOW_MINIMIZE),
    windowMaximizeToggle: () => ipcRenderer.invoke(IPC.WINDOW_MAXIMIZE_TOGGLE),
    windowClose: () => ipcRenderer.invoke(IPC.WINDOW_CLOSE),
});

function on(channel: string, cb: (payload: any) => void) {
    const listener = (_: any, payload: any) => cb(payload);
    ipcRenderer.on(channel, listener);
    return () => ipcRenderer.removeListener(channel, listener);
}
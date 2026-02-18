import type * as DTO from "../shared/ipc/dtos";
import type * as EVT from "../shared/ipc/events";

export { };

declare global {
    interface Window {
        api: {
            pickAudio(): Promise<DTO.PickAudioResponse>;
            chooseOutputPath(req: DTO.ChooseOutputPathRequest): Promise<DTO.ChooseOutputPathResponse>;

            listModels(): Promise<DTO.ListModelsResponse>;
            downloadModel(req: DTO.DownloadModelRequest): Promise<DTO.DownloadModelResponse>;
            removeModel(req: DTO.RemoveModelRequest): Promise<DTO.RemoveModelResponse>;

            startJob(req: DTO.StartJobRequest): Promise<DTO.StartJobResponse>;
            cancelJob(req: { jobId: string }): Promise<DTO.CancelJobResponse>;

            listGeneratedFiles(): Promise<DTO.ListGeneratedFilesResponse>;
            renameGeneratedFile(req: DTO.RenameGeneratedFileRequest): Promise<DTO.RenameGeneratedFileResponse>;
            deleteGeneratedFile(req: DTO.DeleteGeneratedFileRequest): Promise<DTO.DeleteGeneratedFileResponse>;
            openGeneratedFile(req: DTO.OpenGeneratedFileRequest): Promise<DTO.OpenGeneratedFileResponse>;
            showInFolder(req: DTO.ShowInFolderRequest): Promise<DTO.ShowInFolderResponse>;

            onJobProgress(cb: (e: EVT.JobProgressEvent) => void): () => void;
            onJobDone(cb: (e: EVT.JobDoneEvent) => void): () => void;
            onJobError(cb: (e: EVT.JobErrorEvent) => void): () => void;
            onModelDownloadProgress(cb: (e: EVT.ModelsDownloadProgressEvent) => void): () => void;
            onGeneratedChanged(cb: (e: EVT.GeneratedFilesChangedEvent) => void): () => void;

            windowMinimize(): Promise<{ ok: true }>;
            windowMaximizeToggle(): Promise<{ ok: true; maximized: boolean }>;
            windowClose(): Promise<{ ok: true }>;
        };
    }
}
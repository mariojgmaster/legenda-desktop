export type AppErrorCode =
    | "VALIDATION_ERROR"
    | "AUDIO_NOT_SELECTED"
    | "MODEL_NOT_INSTALLED"
    | "OUTPUT_PATH_REQUIRED"
    | "OUTPUT_WRITE_FAILED"
    | "FILE_NOT_FOUND"
    | "FILE_RENAME_FAILED"
    | "FILE_DELETE_FAILED"
    | "PERMISSION_DENIED"
    | "JOB_CANCELED"
    | "UNKNOWN_ERROR";

export type AppErrorDTO = {
    code: AppErrorCode;
    message: string;
    details?: string;
    actionHint?: "OPEN_MODELS" | "PICK_AUDIO" | "CHOOSE_OUTPUT";
};
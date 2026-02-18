export const IPC = {
    PICK_AUDIO: "app:audio:pick",
    PICK_AUDIOS: "app:audio:pickMany",
    CHOOSE_OUTPUT: "app:output:choose",
    CHOOSE_OUTPUT_DIR: "app:output:chooseDir",

    LIST_MODELS: "app:models:list",
    DOWNLOAD_MODEL: "app:models:download",
    REMOVE_MODEL: "app:models:remove",

    JOB_START: "app:jobs:start",
    JOB_CANCEL: "app:jobs:cancel",

    GENERATED_LIST: "app:generated:list",
    GENERATED_RENAME: "app:generated:rename",
    GENERATED_DELETE: "app:generated:delete",
    GENERATED_OPEN: "app:generated:open",
    GENERATED_SHOW_IN_FOLDER: "app:generated:showInFolder",

    GET_FILE_URL: "app:file:url",

    WINDOW_MINIMIZE: "app:window:minimize",
    WINDOW_MAXIMIZE_TOGGLE: "app:window:maximizeToggle",
    WINDOW_CLOSE: "app:window:close",
    APP_SET_THEME: "app:theme:set",

    EVT_JOB_PROGRESS: "evt:jobs:progress",
    EVT_JOB_DONE: "evt:jobs:done",
    EVT_JOB_ERROR: "evt:jobs:error",
    EVT_MODEL_DL_PROGRESS: "evt:models:downloadProgress",
    EVT_GENERATED_CHANGED: "evt:generated:changed"
} as const;
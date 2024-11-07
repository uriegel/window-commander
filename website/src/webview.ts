import { Progress } from "./requests/events"

export declare type WebViewType = {
    initializeNoTitlebar: () => void,
    showDevTools: () => void,
    startDragFiles: (files: string[]) => void,
    request: <T, TR>(method: string, data: T) => Promise<TR>
    registerEvents: <T>(id: string, onEvent: (evt: T)=>void) => void,
    dropFiles: (id: string, move: boolean, droppedFiles: string[]) => void,
    setDroppedFilesEventHandler: (success: boolean) => void
    getRequestUrl: () => string
    closeWindow(): () => void
}

export declare type WebViewEvents = {
    registerShowHidden: (fun: (show: boolean) => void) => void
    registerShowPreview: (fun: (show: boolean) => void) => void
    registerMenuAction: (fun: (cmd: string) => Promise<void>) => void
    registerProgresses: (fun: (p: Progress)=>void) => void
}
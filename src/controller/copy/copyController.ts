import * as R from "ramda"
import { DialogHandle, Slide, Result } from "web-dialog-react"
import CopyConflicts, { ConflictItem } from "../../components/CopyConflicts"
import CopyProgress from "../../components/CopyProgress"
import { FolderViewItem } from "../../components/FolderView"
import { Controller, ControllerType } from "../controller"
import { compareVersion, getItemsType, ItemsType } from "../filesystem"
import { CopyItem, CopyItemsResult, IOError, IOErrorResult, request } from "../../requests/requests"
import { copy, copyInfo } from "./fileSystem"
import { copyInfoToRemote, copyToRemote } from "./toRemoteCopy"
import { copyFromRemote, copyInfoFromRemote } from "./fromRemoteCopy"

export interface CopyController {
    copy: ()=>Promise<IOError|null>
}

const getCopyFunction = (from: ControllerType, to: ControllerType) =>
    from == ControllerType.Remote && to == ControllerType.FileSystem
    ? copyFromRemote
    : from == ControllerType.FileSystem && to == ControllerType.Remote
    ? copyToRemote
    : copy    

const getPreCopyFunction = (from: ControllerType, to: ControllerType) =>
    from == ControllerType.Remote && to == ControllerType.FileSystem
    ? copyInfoFromRemote
    : from == ControllerType.FileSystem && to == ControllerType.Remote
    ? copyInfoToRemote
    : copyInfo

export const getCopyController = (move: boolean, dialog: DialogHandle | null, fromLeft: boolean, fromController: Controller, toController: Controller,
    sourcePath: string, targetPath: string, items: FolderViewItem[], targetItems: FolderViewItem[]): CopyController|null => {
    return fromController.type == ControllerType.FileSystem && toController.type == ControllerType.FileSystem
        || fromController.type == ControllerType.Remote && toController.type == ControllerType.FileSystem
        || fromController.type == ControllerType.FileSystem && toController.type == ControllerType.Remote
    ? getFileSystemCopyController(move, dialog, fromLeft, fromController, toController, sourcePath, targetPath,
        items, targetItems?.filter(n => !n.isDirectory),
        getPreCopyFunction(fromController.type, toController.type),
        getCopyFunction(fromController.type, toController.type))
    : null
}

const getFileSystemCopyController = (move: boolean, dialog: DialogHandle|null|undefined, fromLeft: boolean, fromController: Controller, toController: Controller,
            sourcePath: string, targetPath: string, items: FolderViewItem[], targetItems: FolderViewItem[],
            copyInfo: (sourcePath: string, targetPath: string, items: CopyItem[], move: boolean)=>Promise<CopyItemsResult>,
            copy: (sourcePath: string, targetPath: string, items: CopyItem[], move: boolean, uacShown?: (uac: boolean)=>void, dialog?: DialogHandle|null)=>Promise<IOErrorResult>): CopyController | null => ({
        copy: async () => {
            if (!items || !targetItems || items.length == 0)
                return null
                    
            const copyItems = items
                .filter(n => n.isDirectory)
                .map(n => ({
                    name: n.name,
                    isDirectory: true,
                    size: n.size,
                    time: n.time
                }))
                    
            const res = await copyInfo(sourcePath, targetPath, copyItems, move)
            if (res.error)
                return res.error

            const fileItems = items
                .filter(n => !n.isDirectory)
                    
            const targetItemsMap = R.mergeAll(
                targetItems
                    .filter(n => !n.isDirectory)
                    .map(ti => ({ [ti.name]: ti })))
            const conflictFileItems = fileItems.map(n => {
                const check = targetItemsMap[n.name]
                return check
                ? {
                    name: n.name,
                    iconPath: n.iconPath,
                    size: n.size,
                    time: n.time,
                    exifDate: n.exifDate,
                    version: n.version,
                    targetSize: check.size,
                    targetTime: check.time,
                    targetExifDate: check.exifDate,
                    targetVersion: check.version
                } as ConflictItem
                : undefined                
            }).filter(n => n != undefined) as ConflictItem[]

            const dirInfos = res
                .infos
                ?.filter(n => n.targetSize != null)
                .map(n => ({
                    name: n.name,
                    iconPath: null,
                    subPath: n.subPath,
                    size: n.size,
                    time: n.time,
                    exifDate: null,
                    version: null,
                    targetSize: n.targetSize,
                    targetTime: n.targetTime,
                    targetExifDate: null,
                    targetVersion: null
                })) as ConflictItem[] | undefined
            const conflictItems = dirInfos ? conflictFileItems.concat(dirInfos) : conflictFileItems
            const copyText = conflictItems.length > 0
                ? move ? "Verschieben" : "Kopieren"
                : move ? "verschieben" : "kopieren"
            const type = getItemsType(items)
            const text = conflictItems.length > 0 
                ? `Einträge überschreiben beim ${copyText}?`
                : type == ItemsType.Directory
                ? `Möchtest Du das Verzeichnis ${copyText}?`
                : type == ItemsType.Directories
                ? `Möchtest Du die Verzeichnisse ${copyText}?`
                : type == ItemsType.File
                ? `Möchtest Du die Datei ${copyText}?`
                : type == ItemsType.Files
                ? `Möchtest Du die Dateien ${copyText}?`
                : `Möchtest Du die Verzeichnisse und Dateien ${copyText}?`
            
            const filterNoOverwrite = (item: ConflictItem) =>
                (item.exifDate ?? item.time ?? "") < (item.targetExifDate ?? item.targetTime ?? "")
                && compareVersion(item.version, item.targetVersion) < 0
            
            const defNo = conflictItems.length > 0
                && conflictItems
                    .filter(filterNoOverwrite)
                    .length > 0
                                
            const result = await dialog?.show({
                text,   
                slide: fromLeft ? Slide.Left : Slide.Right,
                extension: conflictItems.length ? CopyConflicts : undefined,
                extensionProps: conflictItems, 
                fullscreen: conflictItems.length > 0,
                btnYes: conflictItems.length > 0,
                btnNo: conflictItems.length > 0,
                btnOk: conflictItems.length == 0,
                btnCancel: true,
                defBtnYes: !defNo && conflictItems.length > 0,
                defBtnNo: defNo
            })
            if (result?.result != Result.Cancel) {

                const startProgressDialog = () => 
                    setTimeout(async () => {
                        const res = await dialog?.show({
                            text: `Fortschritt beim ${move ? "Verschieben" : "Kopieren"}`,
                            slide: fromLeft ? Slide.Left : Slide.Right,
                            extension: CopyProgress,
                            btnCancel: true
                        })
                        if (res?.result == Result.Cancel)
                            await request("cancelCopy", {})        
                    }, 1000)                    

                let timeout = startProgressDialog()

                const itemsToCopy = fileItems
                    .map(n => ({ name: n.name, size: n.size, time: n.time, subPath: undefined }) as CopyItem)
                    .concat((res.infos?? []).map(n => ({ name: n.name, size: n.size, time: n.time, subPath: n.subPath || undefined })))
 
                const copyItems = result?.result == Result.Yes
                    ? itemsToCopy
                    : R.without(
                        conflictItems.map(n => ({ name: n.name, size: n.size, time: n.time, subPath: n.subPath || undefined })),
                        itemsToCopy)
                
                const ioResult = await copy(sourcePath!, targetPath!, copyItems, move, (uac: boolean) => {
                    if (uac)
                        clearTimeout(timeout)        
                    else
                        timeout = startProgressDialog()
                }, dialog)
                clearTimeout(timeout)
                dialog?.close()
                return ioResult.error != undefined ? ioResult.error : null
            }
            else
               return null
        }
    })


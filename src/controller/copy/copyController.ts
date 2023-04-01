import * as R from "ramda"
import { DialogHandle, Slide, Result } from "web-dialog-react"
import CopyConflicts, { ConflictItem } from "../../components/CopyConflicts"
import CopyProgress from "../../components/CopyProgress"
import { FolderViewItem } from "../../components/FolderView"
import { Controller, ControllerType } from "../controller"
import { compareVersion, getItemsType, ItemsType } from "../filesystem"
import { IOError, IOErrorResult, request } from "../../requests/requests"

export interface CopyController {
    copy: ()=>Promise<IOError|null>
}

export const getCopyController = (move: boolean, dialog: DialogHandle|null, fromLeft: boolean, fromController?: Controller, toController?: Controller,
    sourcePath?: string, targetPath?: string, items?: FolderViewItem[], targetItems?: FolderViewItem[]): CopyController|null => {
    if (fromController?.type == ControllerType.FileSystem && toController?.type == ControllerType.FileSystem)
        return getFileSystemCopyController(move, dialog, fromLeft, fromController, toController, sourcePath, targetPath,
            items?.filter(n => !n.isDirectory), targetItems?.filter(n => !n.isDirectory))
    else
        return null
}

const getFileSystemCopyController = (move: boolean, dialog: DialogHandle|null, fromLeft: boolean, fromController?: Controller, toController?: Controller,
    sourcePath?: string, targetPath?: string, items?: FolderViewItem[], targetItems?: FolderViewItem[]): CopyController | null => ({
        copy: async () => {
            if (!items || !targetItems || items.length == 0)
                return null
            
            const targetItemsMap = R.mergeAll(targetItems.map(ti => ({ [ti.name]: ti })))
            const conflictItems = items.map(n => {
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

                const timeout = setTimeout(async () => {
                    const res = await dialog?.show({
                        text: `Fortschritt beim ${move ? "Verschieben" : "Kopieren"}`,
                        slide: fromLeft ? Slide.Left : Slide.Right,
                        extension: CopyProgress,
                        btnCancel: true
                    })
                    if (res?.result == Result.Cancel)
                        await request("cancelCopy", {})        
                }, 1000)
                const copyItems = result?.result == Result.Yes
                    ? items.map(n => ({ name: n.name, size: n.size }))
                    : R.without(conflictItems.map(n => ({ name: n.name, size: n.size })), items.map(n => ({ name: n.name, size: n.size })))
                let ioResult = await request<IOErrorResult>("copyitems", {
                    path: sourcePath!,
                    targetPath: targetPath!,
                    items: copyItems,
                    move
                })
                clearTimeout(timeout)
                dialog?.close()
                return ioResult.error != undefined ? ioResult.error : null
            }
            else
               return null
        }
    })

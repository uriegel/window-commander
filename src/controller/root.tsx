import { SpecialKeys } from "virtual-table-react"
import { FolderViewItem } from "../components/FolderView"
import IconName, { IconNameType } from "../components/IconName"
import { getPlatform, Platform } from "../globals"
import { Controller, ControllerResult, ControllerType, formatSize} from "./controller"
import { REMOTES } from "./remotes"
import { GetRootResult, request } from "../requests/requests"

export const ROOT = "root"
const platform = getPlatform()

const renderWindowsRow = (item: FolderViewItem) => [
    (<IconName namePart={item.name} type={
        item.name == REMOTES
        ? IconNameType.Remote
        : IconNameType.Root
    } />),
    item.description ?? "",
    formatSize(item.size)
]

const renderLinuxRow = (item: FolderViewItem) => [
    (<IconName namePart={item.name} type={
        item.name == '~'
        ? IconNameType.Home
        : item.name == REMOTES
        ? IconNameType.Remote
        : IconNameType.Root
    } />),
    item.description ?? "",
    item.mountPoint ?? "",
    formatSize(item.size)
]

const getWindowsColumns = () => ({
	columns: [
		{ name: "Name" },
		{ name: "Beschreibung" },
		{ name: "Größe", isRightAligned: true }
	],
    getRowClasses,
	renderRow: renderWindowsRow
})

const getLinuxColumns = () => ({
	columns: [
		{ name: "Name" },
        { name: "Bezeichnung" },
        { name: "Mountpoint" },
		{ name: "Größe", isRightAligned: true }
    ],
    getRowClasses,
	renderRow: renderLinuxRow
})

const onWindowsEnter = (_: string, item: FolderViewItem, keys: SpecialKeys) => 
({
    processed: false, 
    pathToSet: item.name
}) 

const onLinuxEnter = (_: string, item: FolderViewItem, keys: SpecialKeys) => 
({
    processed: false, 
    pathToSet: item.mountPoint || item.mountPoint!.length > 0 ? item.mountPoint : item.name
}) 

export const getRootController = (controller: Controller | null): ControllerResult => 
    controller?.type == ControllerType.Root
    ? ({ changed: false, controller })
    : ({ changed: true, controller: { 
        type: ControllerType.Root, 
        id: ROOT,
        getColumns: platform == Platform.Windows ? getWindowsColumns : getLinuxColumns,
        getItems,
        getExtendedItems: async () => ({ path: "", exifTimes: [], versions: [] }),
        setExtendedItems: items=>items,
        onEnter: platform == Platform.Windows ? onWindowsEnter : onLinuxEnter,
        sort: (items: FolderViewItem[]) => items,
        itemsSelectable: false,
        appendPath: (path: string, subPath: string) => subPath,
        rename: async () => null,
        extendedRename: async () => null,
        createFolder: async () => null,
        deleteItems: async () => null,
        onSelectionChanged: () => {}
    }})

const getItems = async () => {
	const items = await request<GetRootResult>("getroot")
    return {
        path: ROOT,
        dirCount: items.length,
        fileCount: 0,
        items
    }
}

const getRowClasses = (item: FolderViewItem) => 
    item.isMounted == false
        ? ["notMounted"]
        : []


import { TableColumns } from "virtual-table-react"
import { FolderViewItem } from "../components/FolderView"
import IconName from "../components/IconName"
import { Controller, ControllerResult, ControllerType, OnEnterResult, formatDateTime, formatSize, sortItems } from "./controller"
import { getSortFunction } from "./filesystem"
import { REMOTES } from "./remotes"
import { IconNameType } from "../enums"
import { AsyncResult, Err, ErrorType, Nothing, Ok, nothing } from "functional-extensions"
import { GetExtendedItemsResult, GetItemsResult, IOError } from "../requests/requests"

export const REMOTE = "remote"

const renderRow = (item: FolderViewItem) => [
	(<IconName namePart={item.name} type={
        item.isParent
        ? IconNameType.Parent
        : item.isDirectory
        ? IconNameType.Folder
        : IconNameType.File}
        iconPath={item.name.getExtension()} />),
    formatDateTime(item?.time),
    formatSize(item.size)
]

const getRowClasses = (item: FolderViewItem) => 
	item.isHidden
		? ["hidden"]
		: []

const getColumns = () => ({
	columns: [
		{ name: "Name", isSortable: true, subColumn: "Erw." },
		{ name: "Datum", isSortable: true },
		{ name: "Größe", isSortable: true, isRightAligned: true }
	],
	getRowClasses,
	renderRow
} as TableColumns<FolderViewItem>)

const getItems = () => AsyncResult.from(new Err<GetItemsResult, ErrorType>({status: IOError.Canceled, statusText: ""}))
// TODO
// const getItems = async (path: string, showHidden: boolean, sortIndex: number, sortDescending: boolean) => {
// 	const res = await request<GetItemResult>("getremotefiles", {
// 		path,
// 		showHiddenItems: showHidden
// 	})
// 	return { ...res, items: addParent(sort(res.items, sortIndex, sortDescending)) }
// }

const sort = (items: FolderViewItem[], sortIndex: number, sortDescending: boolean) => 
	sortItems(items, getSortFunction(sortIndex, sortDescending), true) 

export const getRemoteController = (controller: Controller | null): ControllerResult => 
    controller?.type == ControllerType.Remote
    ? ({ changed: false, controller })
    : ({ changed: true, controller: { 
        type: ControllerType.Remote, 
        id: REMOTE,
        getColumns,
		getItems,
		updateItems: ()=>null,
		getPath: () => REMOTE,
		getExtendedItems: () => AsyncResult.from(new Err<GetExtendedItemsResult, ErrorType>({status: IOError.Canceled, statusText: ""})),
		setExtendedItems: items => items,
		cancelExtendedItems: () => { },
		onEnter: ({ path, item }) => 
			AsyncResult.from(new Ok<OnEnterResult, ErrorType>(
				item.isParent && path.split("/").filter(n => n.length > 0).sideEffectForEach(n => console.log("Eintrag", n)).length - 1 == 1
				?  ({
					processed: false, 
					pathToSet: REMOTES,
					latestPath: path
				}) 
				: item.isParent
				? ({
					processed: false, 
					pathToSet: path.getParentPath(),
					latestPath: path.extractSubPath()
				}) 
				: item.isDirectory
				? ({
					processed: false, 
					pathToSet: path.appendPath(item.name)
				}) 
				: { processed: true })),
        sort,
        itemsSelectable: true,
        appendPath: (path: string, subPath: string) => path.appendPath(subPath),
		rename: () => AsyncResult.from(new Ok<string, ErrorType>("")),
		extendedRename: async () => null,
		renameAsCopy: async () => null,
        createFolder: () => AsyncResult.from(new Ok<string, ErrorType>("")),
        deleteItems: () => AsyncResult.from(new Ok<Nothing, ErrorType>(nothing)),
		onSelectionChanged: () => { },
		cleanUp: () => { }
    }})


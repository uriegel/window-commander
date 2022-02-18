import { Commander } from "./commander"
const electron = window.require('electron')

export function initialize(commanderToSet: Commander) { commander = commanderToSet }

window.onRename = () => commander.rename()
window.onExtendedRename = () => commander.extendedRename()
window.onCreateFolder = () => commander.createFolder()
window.onCopy = () => commander.copy()
window.onMove = () => commander.copy(true)
window.onDelete = () => commander.deleteSelectedItems()
window.onClose = () => close()
window.onSelectAll = () => commander.selectAll()
window.onSelectNone = () => commander.selectNone()
window.onViewer = isChecked => commander.showViewer(isChecked)
window.onAdaptPath = () => commander.adaptPath()
window.onRefresh = () => commander.refresh()
window.onHidden = isChecked => commander.showHidden(isChecked)
window.onHideMenu = (isChecked: boolean) => commander.hideMenu(isChecked)
window.onFullscreen = () => electron.ipcRenderer.send("fullscreen")
window.onDevTools = () => electron.ipcRenderer.send("openDevTools")

var commander: Commander
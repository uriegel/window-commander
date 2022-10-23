import 'web-electron-titlebar'
import 'web-menu-bar'
import 'web-dialog-box'
import 'grid-splitter'
import 'web-pie-progress'
import './components/folder'
import './remotes'
import { initializeMenu } from './menu'
import { Folder } from './components/folder'
import { Menubar } from 'web-menu-bar'
import { request,  } from "./requests"
import { refreshViewer, showViewer as viewer } from './viewer'
import { ElectronTitlebar } from 'web-electron-titlebar'
import { DialogBox, Result } from 'web-dialog-box'
import { wantClose } from './copy'
import { deleteRemotes, initRemotes, renameRemote, RenameRemote } from './remotes'
import { filter, fromEvent, map } from 'rxjs'

export function activateClass(element: HTMLElement, cls: string, activate: boolean) {
    if (activate != false)
        element.classList.add(cls)
    else
        element.classList.remove(cls)
}

export function forceClosing() {  
    forceClose = true
}
window.addEventListener('beforeunload', evt => {
    if (!forceClose && !wantClose()) {
        evt.preventDefault()
        evt.returnValue = ""
    }
})
var forceClose = false

const dialog = document.querySelector('dialog-box') as DialogBox    

export async function requestBox(text: string) {
    
    const res = await dialog!.show({
        text,
        btnOk: true,
        btnCancel: true,
        defBtnOk: true
    })
    activeFolderSetFocus()
    return res.result == Result.Ok
}

const statusText = document.getElementById("statusText")!
const dirsText = document.getElementById("dirs")!
const filesText = document.getElementById("files")!
const titlebar = document.getElementById("titlebar")! as ElectronTitlebar

const params = new URLSearchParams(window.location.search)
if (params.get("frame") == "true") 
    titlebar.setAttribute("no-titlebar", "true")
else {
    titlebar.setAttribute("icon", "images/kirk.png")
    titlebar.addEventListener("onmaximize", () => request("maximize"))
    titlebar.addEventListener("onminimize", () => request("minimize"))
    titlebar.addEventListener("onrestore", () => request("restore"))
    titlebar.addEventListener("onclose", () => request("close"))
}

initializeMenu()
setTheme(params.get("theme") || "") 

type EventNothing = {
    Case: "Nothing"
}

type EventThemeChanged = {
    Case: "ThemeChanged",
    Fields: string[1]
}

type EventMaximize = {
    Case: "ElectronMaximize"
}

type EventUnmaximize = {
    Case: "ElectronUnmaximize"
}

type EventFullScreen = {
    Case: "Fullscreen",
    Fields: boolean[]
}

type RenameRemoteType = {
    Case:   "RenameRemote",
    Fields: Array<RenameRemote>
}

type DeleteRemotesType = {
    Case:   "DeleteRemotes",
    Fields: Array<string[]>
}

type CommanderEvent = 
    | EventNothing
    | EventThemeChanged
    | EventMaximize
    | EventUnmaximize
    | EventFullScreen
    | RenameRemoteType
    | DeleteRemotesType

var currentPath = ""

const toCommanderEvent = (event: MessageEvent) => {
    return JSON.parse(event.data) as CommanderEvent
}

const source = new EventSource("commander/sse")
let commanderEvents = fromEvent<MessageEvent>(source, 'message')
    .pipe(map(toCommanderEvent))

const themeChangedEvents = commanderEvents
    .pipe(filter(n => n.Case == "ThemeChanged"))
    .pipe(map(n => (n as EventThemeChanged).Fields[0]))
const electronMaximizeEvents = commanderEvents
    .pipe(filter(n => n.Case == "ElectronMaximize"))
const electronUnmaximizeEvents = commanderEvents
    .pipe(filter(n => n.Case == "ElectronUnmaximize"))
const fullscreenEvents = commanderEvents
    .pipe(filter(n => n.Case == "Fullscreen"))
    .pipe(map(n => (n as EventFullScreen).Fields[0]))
const renameRemoteEvents = commanderEvents
    .pipe(filter(n => n.Case == "RenameRemote"))
    .pipe(map(n => (n as RenameRemoteType).Fields[0]))
const deleteRemotesEvents = commanderEvents
    .pipe(filter(n => n.Case == "DeleteRemotes"))
    .pipe(map(n => (n as DeleteRemotesType).Fields[0]))

themeChangedEvents.subscribe(setTheme)
electronMaximizeEvents.subscribe(() => titlebar.setMaximized(true))
electronUnmaximizeEvents.subscribe(() => titlebar.setMaximized(false))
fullscreenEvents.subscribe(titlebar.showTitlebar)
renameRemoteEvents.subscribe(renameRemote)
deleteRemotesEvents.subscribe(deleteRemotes)

initRemotes()        

function setTheme(theme: string) {
    activateClass(document.body, "adwaitaDark", false) 
    activateClass(document.body, "adwaita", false) 
    activateClass(document.body, "breezeDark", false) 
    activateClass(document.body, "breeze", false) 
    activateClass(document.body, "windows", false) 
    activateClass(document.body, "windowsDark", false) 
    activateClass(document.body, theme, true) 
}

export function getActiveFolder() { return activeFolder == folderLeft ? folderLeft : folderRight }
function getInactiveFolder() { return activeFolder == folderLeft ? folderRight : folderLeft }

export function onCopy() {
    activeFolder.copy(getInactiveFolder(), activeFolder == folderLeft)
}

export function onMove() {
    activeFolder.copy(getInactiveFolder(), activeFolder == folderLeft, true)
}

export function onRename() {
    activeFolder.onRename()
}

export function onCreateFolder() {
    activeFolder.createFolder()
}

export function onDelete() {
    activeFolder.deleteSelectedItems()
}

export function onAdaptPath() {
    getInactiveFolder().changePath(activeFolder.getCurrentPath())
}

export function onRefresh() {
    activeFolder.reloadItems()
}

export function onSelectAll() {
    activeFolder.selectAll()
}

export function onSelectNone() {
    activeFolder.selectNone()
}

export function onViewer(show: boolean) {
    viewer(show, currentPath)
}

export function onSetHidden(showHidden: boolean) {
    folderLeft.showHidden(showHidden)
    folderRight.showHidden(showHidden)
}

export function activeFolderSetFocus() {
    activeFolder.setFocus()
}

function onPathChanged(evt: Event) {
    const detail = (evt as CustomEvent).detail
    currentPath = detail.path
    refreshViewer(detail.path)
    setStatus(detail.path, detail.dirs, detail.files)
}

function setStatus(path: string, dirs: number, files: number) {
    statusText.innerText = `${path}`
    dirsText.innerText = `${dirs ? dirs - 1 : "" } Verz.` 
    filesText.innerText = `${dirs ? files : "" } Dateien` 
}

const folderLeft = document.getElementById("folderLeft")! as Folder
const folderRight = document.getElementById("folderRight")! as Folder
var activeFolder = folderLeft

const menu = document.getElementById("menu")! as Menubar
menu.addEventListener('menuclosed', () => activeFolder.setFocus())
folderLeft.addEventListener("onFocus", () => activeFolder = folderLeft)
folderRight.addEventListener("onFocus", () => activeFolder = folderRight)
folderLeft.addEventListener("pathChanged", onPathChanged)
folderRight.addEventListener("pathChanged", onPathChanged)
folderLeft.addEventListener("tab", () => folderRight.setFocus())
folderRight.addEventListener("tab", () => folderLeft.setFocus())
folderLeft.addEventListener("dragAndDropCopy", onCopy)
folderRight.addEventListener("dragAndDropCopy", onCopy)
folderLeft.addEventListener("dragAndDropMove", onMove)
folderRight.addEventListener("dragAndDropMove", onMove)

folderLeft.setFocus()
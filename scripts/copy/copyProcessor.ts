import { Settings } from "web-dialog-box"
import { FileError } from "../engines/file"
import { Platform } from "../platforms/platforms"
const { getFiles } = window.require("rust-addon")
const fspath = window.require('path')
const { rmdir } = window.require('fs/promises')

const fs = window.require('fs')
const http = window.require('http')

export function initializeCopying(onFinished: (folderIdsToRefresh: string[])=>void, onShowErrors: (errorContent: Settings)=>Promise<void>) {
    copyProcessor = new CopyProcessor(onFinished, onShowErrors)
}

export var copyProcessor : CopyProcessor

enum Type {
    Copy,
    CopyAndroid,
    DeleteEmptyFolders
}

class CopyProcessor {
    constructor (public onFinished: (folderIdsToRefresh: string[])=>void, onShowErrors: (errorContent: Settings)=>Promise<void>) { 
        this.progressError.onclick = () => {
            this.progressError.classList.add("hidden")
            setTimeout(async () => {
                const items = this.copyExceptions.map(n => {
                    const item = document.createElement("div")
                    item.innerText = n.description
                    return item
                })
    
                this.errorList.innerText = ""
                items.forEach(n => this.errorList.appendChild(n))
        
                await onShowErrors({
                    text: "Fehler aufgetreten",
                    btnOk: true,
                    extended: "error-list"
                })
                this.copyExceptions = []
            })
        }

        this.progressErrorClose.onclick = evt => {
            this.progressError.classList.add("hidden")
            // TODO
            //activeFolder.setFocus()
            evt.preventDefault()
            evt.stopPropagation()
        }
    
    }

    private progress = document.getElementById("progress")!
    private progressError = document.getElementById("progressError") as HTMLElement
    private progressErrorClose = document.getElementById("progressErrorClose")!
    private errorList = document.getElementById("error-list") as HTMLElement
    private queue: Job[] = []
    private totalSize = 0
    private alreadyCopied = 0
    private folderIdsToRefresh: string[] = []
    private isProcessing = false
    private copyExceptions: FileError[] = []

    private process = () => setTimeout(
        async () => {
            while (true) {
                const job = this.queue.shift()
                if (!job) 
                    break
                try {
                    switch (job.type) {
                        case Type.Copy:
                            await Platform.copyFileAsync(job.source, job.target, c => this.onProgress(this.alreadyCopied + c, this.totalSize), job.move, job.overwrite)
                            break
                        case Type.CopyAndroid:
                            await this.copyAndroid(job.source, job.target, job.move, job.overwrite, c => this.onProgress(this.alreadyCopied + c, this.totalSize))
                            break
                        case Type.DeleteEmptyFolders:
                            await deleteEmptyFolders(job.path, job.folders)
                            break
                    }
                } catch (err) {
                    this.onException(err)
                }
                this.alreadyCopied += job.size
            }
            this.totalSize = 0
            this.alreadyCopied = 0
            
            this.progress.classList.remove("active")            
            this.onFinished(this.folderIdsToRefresh)
            this.folderIdsToRefresh = []
            this.isProcessing = false
        }
    )

    addDeleteEmptyFolders(path: string, folders: string[], foldersToRefresh: string[]) {
        this.folderIdsToRefresh = [...new Set(this.folderIdsToRefresh.concat(foldersToRefresh))]
        this.queue.push({ path, folders, size: 0, type: Type.DeleteEmptyFolders })

        if (!this.isProcessing) {
            this.isProcessing = true
            this.process()
        }
    }

    addJob(source: string, target: string, move: boolean, overwrite: boolean, folderIdsToRefresh: string[]) {
        const size = fs.statSync(source).size
        this.totalSize += size
        this.folderIdsToRefresh = [...new Set(this.folderIdsToRefresh.concat(folderIdsToRefresh))]

        this.queue.push({
            source, target, move, overwrite, size, type: Type.Copy
        })
       
        if (!this.isProcessing) {
            this.isProcessing = true
            this.process()
        }
    }

    addExternalJob(source: string, target: string, move: boolean, overwrite: boolean, folderIdsToRefresh: string[]) {
        const size = 1
        this.totalSize += size
        this.folderIdsToRefresh = [...new Set(this.folderIdsToRefresh.concat(folderIdsToRefresh))]

        this.queue.push({
            source, target, move, overwrite, size, type: Type.CopyAndroid
        })
        
        if (!this.isProcessing) {
            this.isProcessing = true
            this.process()
        }
    }

    onProgress(current: number, total: number) {
        this.progress.classList.add("active")
        this.progress.setAttribute("progress", (current / total * 100.0).toString())
    }
    
    onException(err: any) {
        this.copyExceptions = this.copyExceptions.concat(err)

        // TODO if error dialog is open append
        this.progressError.classList.remove("hidden")
    }
    
    async copyAndroid(source: string, target: string, move: boolean, overwrite: boolean, onProgress: (p: number)=>void) {
        onProgress(0)

        const keepAliveAgent = new http.Agent({
            keepAlive: true,
            keepAliveMsecs: 40000
        })

        const pos = source.indexOf('/', 9)
        const ip = source.substring(9, pos)
        const path = source.substring(pos)

        let date = "0"
        const download = async (data: any) => new Promise<void>((res, rej) => {
            const file = fs.createWriteStream(target)
                        
            var payload = JSON.stringify(data)
            const req = http.request({
                hostname: ip,
                port: 8080,
                path: "/getfile",
                agent: keepAliveAgent,
                timeout: 40000,
                method: 'POST',
                headers: {
					'Content-Type': 'application/json; charset=UTF-8',
					'Content-Length': Buffer.byteLength(payload)
				}            
            }, (response: any) => {
                date = response.headers["x-file-date"] 
                return response.pipe(file)
            })

            file.on('finish', () => {
                if (date) {
                    const time = new Date(Number.parseInt(date))
                    try {
                        fs.utimesSync(target, time, time)
                    } catch(e) {
                        console.error("change time", e)
                    }
                }
                res()
            })

            req.on("error", rej)
            req.write(payload)
            req.end()        
        })

        await download({ path })
        onProgress(1)
    }
}

type CopyJob = {
    type: Type.Copy | Type.CopyAndroid  
    size: number
    source: string
    target: string
    move: boolean
    overwrite: boolean
}

type DeleteJob = {
    type: Type.DeleteEmptyFolders 
    size: number
    path: string
    folders: string[]
}

type Job = CopyJob | DeleteJob

async function deleteEmptyFolders(path: string, folders: string[]) {
    const folderPathes = folders.map(n => fspath.join(path, n))

    function getSubDirs(path: string) {
        path = fspath.normalize(path).replace(":.", ":\\")
        return ( getFiles(path) as any[])
            .filter(n => n.isDirectory)
            .map(n => fspath.join(path, n.name))
    }
    
    async function removeDirectory(folderPath: string) {
        var items = getSubDirs(folderPath)
        if (items.length > 0) {
            try {
                await Promise.all(items.map(removeDirectory))
            } catch (err)  {
                console.log("error while deleting empty folders", err)
            }
        }
        try {
            await rmdir(folderPath)
        } catch (err)  {
            console.log("error while deleting empty folder", err)
        }
    }

    try {
        await Promise.all(folderPathes.map(removeDirectory))
    } catch (err)  {
        console.log("error while deleting empty folders", err)
    }
}

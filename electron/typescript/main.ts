import { app, BrowserWindow, BrowserWindowConstructorOptions } from "electron"
import http from "http"

type Events = {
    Case: "ShowDevTools" | "ShowFullscreen" | "Maximize" | "Minimize" | "Restore" | "Close"
}

type Methods = "sendbounds" | "getevents" | "electronmaximize" | "electronunmaximize" | "fullscreen" | "fullscreenoff"
type Bounds = {
    x:            number | undefined
    y:            number | undefined
    width:        number
    height:       number
    isMaximized?: boolean
    theme?:       string
    frame?:       boolean
}
type Empty = {}
type InputData = Bounds | Empty

let bounds: BrowserWindowConstructorOptions = JSON.parse(process.env['Bounds']!)

const createWindow = async () => {  
    bounds.show = false
    
    const win = new BrowserWindow(bounds)
    if ((bounds as Bounds).isMaximized)
        win.maximize()
    win.removeMenu()

    win.once('ready-to-show', win.show)
    win.on('maximize', async () => {
        const bounds: Bounds = win.getBounds()
        bounds.isMaximized = true
        await request("sendbounds", bounds)
        await request("electronmaximize", {})
    })
    win.on('unmaximize', async () => {
        await request("electronunmaximize", {})
    })

    let doClose = false
    win.on("close", async (evt: Event) => {
        if (!doClose &&!win.isMaximized()) {
            evt.preventDefault()
            doClose = true
            const bounds: Bounds = win.getBounds()
            await request("sendbounds", bounds)
            win.close()
        }
    })   

    win.loadURL(`http://localhost:20000?theme=${(bounds as Bounds).theme}&frame=${(bounds as Bounds).frame}`)

    async function getEvents() {
        await request("getevents", {})
        getEvents()    
    }
    getEvents()

    async function request(method: Methods, inputData: InputData): Promise<void> {
        const keepAliveAgent = new http.Agent({
            keepAlive: true,
            keepAliveMsecs: 40000
        })

        return new Promise((resolve, reject) => {
            var payload = JSON.stringify(inputData)
            let responseData = ''
            const req = http.request({
                hostname: "localhost",
                port: 20000,
                path: `/commander/${method}`,
                agent: keepAliveAgent,
                timeout: 40000,
                method: 'POST',
                headers: {
					'Content-Type': 'application/json; charset=UTF-8',
					'Content-Length': Buffer.byteLength(payload)
				}            
            }, (response: any) => {
                response.setEncoding('utf8')
                response.on('data', (chunk: any) => responseData += chunk)
                response.on('end', () => {
                    const evt = JSON.parse(responseData) as Events
                    switch (evt.Case) {
                        case "ShowDevTools":
                            win.webContents.openDevTools()
                            break
                        case "ShowFullscreen":
                            win.setFullScreen(!win.isFullScreen())
                            if (win.isFullScreen())
                                request("fullscreen", {})
                            else
                                request("fullscreenoff", {})
                            break
                        case "Maximize":
                            win.maximize()
                            break
                        case "Minimize":
                            win.minimize()
                            break
                        case "Restore":
                            win.unmaximize()
                            break
                        case "Close":
                            win.close()
                            break
                    }
                    resolve()
                })
            })        
            
            req.on('error', (e: any) => {
                reject(e)
            })
            req.write(payload)
            req.end()        
        }) 
    }    
}

app.on('ready', createWindow)

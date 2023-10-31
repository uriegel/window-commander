import { isWindows } from "../globals"
import './Titlebar.css'

// TODO in webview.d.ts
declare const webViewMinimize: () => void
declare const webViewRestore: () => void
declare const webViewMaximize: () => void

interface TitlebarProps {
    menu: JSX.Element
    isMaximized: boolean
}

const Titlebar = ({ menu, isMaximized }: TitlebarProps) => {
    
    const onMinimize = () => webViewMinimize()
    const onRestore = () => webViewRestore()
    const onMaximize = () => webViewMaximize()
    const onClose = () => window.close()
    
    return  isWindows()        
        ? (<div className="titlebar">
                <img src="http://localhost:20000/commander/getfavicon"/>
                {menu}
                <div className="titlebarGrip">
                    <span>Commander</span>
                </div>
                <div className="titlebarButton" onClick={onMinimize}><span className="dash">&#x2012;</span></div>
                {
                    isMaximized
                    ? (<div className="titlebarButton" onClick={onRestore}><span>&#10697;</span></div>)
                    : (<div className="titlebarButton" onClick={onMaximize}><span>&#9744;</span></div>)
                }
                <div className={"titlebarButton close"} onClick={onClose}><span>&#10005;</span></div>
            
            </div>)
        : menu
}

export default Titlebar
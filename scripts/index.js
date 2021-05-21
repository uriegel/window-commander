import './components/gridsplitter.js'
import './folder.js'

const folderLeft = document.getElementById("folderLeft")
const folderRight = document.getElementById("folderRight")
const splitter = document.getElementById('splitter')

const theme = initializeCallbacks(onTheme, onShowHidden)
onTheme(theme)


folderLeft.addEventListener("onFocus", evt => {
     activeFolder = folderLeft
})
folderRight.addEventListener("onFocus", evt => {
     activeFolder = folderRight
})

const onPathChanged = evt => setTitle(evt.detail)

folderLeft.addEventListener("pathChanged", onPathChanged)
folderRight.addEventListener("pathChanged", onPathChanged)

function onTheme(theme) {
    ["themeAdwaita", "themeAdwaitaDark"].forEach(n => {
        document.body.classList.remove(n)
        splitter.classList.remove(n)
    })
    splitter
    document.body.classList.add(theme)    
    splitter.classList.add(theme)    
    folderLeft.changeTheme(theme)
    folderRight.changeTheme(theme)
}

function onShowHidden(hidden) {
    folderLeft.showHidden(hidden)
    folderRight.showHidden(hidden)
}

folderLeft.setFocus()

var activeFolder = folderLeft









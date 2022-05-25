module Directory

open FSharpRailway
open FSharpTools
open System.IO
open System.Reactive.Subjects

open Configuration
open Directory
open Engine
open Gtk
open Model
open FileSystem

let extendColumns columns = columns

let private getIconScript = 
    let filename = saveResource (getElectronFile "geticon.py", "python/geticon.py")
    let getIconScript () = filename
    getIconScript    

let getIconPath (fileInfo: FileInfo) = 
    match fileInfo.Extension with
    | ext when ext |> String.length > 0 -> ext
    | _                                 -> ".noextension"

open Option

let getIcon ext = async {
    let getKdeIcon ext = async {
        let extractMime str = 
            let pos1 = str |> String.indexOf "('" 
            let pos2 = str |> String.indexOf "',"
            match pos1, pos2 with
            | Some pos1, Some pos2 -> Some (str |> String.substring2 (pos1+2) (pos2-pos1-2))
            | _                    -> None

        let replaceSlash str = Some (str |> String.replaceChar  '/' '-')
        let getMime = extractMime >=> replaceSlash

        let mapVarious mime =
            match mime with
            | "/usr/share/icons/breeze/mimetypes/16/application-x-msdos-program.svg" -> "/usr/share/icons/breeze/mimetypes/16/application-x-ms-dos-executable.svg"
            | "/usr/share/icons/breeze/mimetypes/16/application-java-archive.svg"    -> "/usr/share/icons/breeze/mimetypes/16/application-x-jar.svg"
            | s -> s

        let! mimeType = Process.runCmd "python3" (sprintf "%s *%s" (getIconScript ()) ext)

        let icon = 
            sprintf "/usr/share/icons/breeze/mimetypes/16/%s.svg" (mimeType |> getMime |> defaultValue "application-x-zerosize")
            |> mapVarious
            |> getExistingFile
            |> Option.defaultValue "/usr/share/icons/breeze/mimetypes/16/application-x-zerosize.svg"
        return icon, "image/svg+xml"
    }

    return! 
        match getPlatform () with
        | Platform.Kde -> getKdeIcon ext
        | _            -> async { return Gtk.getIcon ext, "image/png" }
}

let appendPlatformInfo _ _ _ _ _ = ()

let deleteItems = 
    deleteItems
    >> mapOnlyError
    >> getError
    >> serializeToJson


type ConflictItem = {
    Conflict:   string
    SourceTime: System.DateTime
    TargetTime: System.DateTime
    SourceSize: int64
    TargetSize: int64
}

type FileSystemType = 
    | None = 0
    | File = 1
    | Directory = 2

let getCopyConflicts items sourcePath targetPath =

    let getFileSystemType path = 
        if existsFile path then
            FileSystemType.File
        else if existsDirectory path then
            FileSystemType.Directory
        else
            FileSystemType.None

    let getInfo item = 
        let sourcePath = combine2Pathes sourcePath item 
        let targetPath = combine2Pathes targetPath item 
        
        match getFileSystemType targetPath with 
            | FileSystemType.File -> 
                let sourceInfo = FileInfo sourcePath
                let targetInfo = FileInfo targetPath
                Some {
                    Conflict = item
                    SourceTime = sourceInfo.LastWriteTime
                    SourceSize = sourceInfo.Length
                    TargetTime = targetInfo.LastWriteTime
                    TargetSize = targetInfo.Length
                }
            | FileSystemType.Directory -> 
                let sourceInfo = DirectoryInfo sourcePath
                let targetInfo = DirectoryInfo targetPath
                Some {
                    Conflict = item
                    SourceTime = sourceInfo.LastWriteTime
                    SourceSize = 0
                    TargetTime = targetInfo.LastWriteTime
                    TargetSize = 0
                }
            | _ -> None        

    items 
    |> Seq.choose getInfo
    |> serializeToJson


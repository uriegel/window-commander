module Directory

open FSharpTools
open System.IO
open System.Text.Json

open Engine
open Model
open Configuration

let getEngineAndPathFrom path item = 
    match path, item with
    | "/", ".." -> EngineType.Root, "root"
    | _, _      -> EngineType.Directory, Path.Combine (path, item)

let getItems engine path = async {

    let getDirItem (dirInfo: DirectoryInfo) = {
        Name =        dirInfo.Name
        Size =        0
        ItemType =    ItemType.Directory
        IsDirectory = true
        IconPath    = None
        IsHidden    = false
        Time        = dirInfo.LastWriteTime
    }

    let getFileItem (fileInfo: FileInfo) = {
        Name =        fileInfo.Name
        Size =        fileInfo.Length
        ItemType =    ItemType.File
        IsDirectory = false
        IconPath    = None
        IsHidden    = false
        Time        = fileInfo.LastWriteTime
    }

    let sortByName item = item.Name |> String.toLower 

    let dirInfo = DirectoryInfo(path)
    let dirs = 
        dirInfo.GetDirectories()
        |> Array.map getDirItem 
        |> Array.sortBy sortByName
    let files = 
        dirInfo.GetFiles()
        |> Array.map getFileItem 

    let parent = [| { 
        Name = ".."
        Size = 0
        ItemType = ItemType.Parent
        IconPath = None
        IsHidden = false
        IsDirectory = true
        Time = System.DateTime.Now 
    } |]

    let items = Array.concat [
        parent
        dirs
        files
    ]
    let result = {|
        Items =  items
        Path =   dirInfo.FullName
        Engine = EngineType.Directory
        Columns = 
            if engine <> EngineType.Directory then Some [| 
                    { Name = "Name"; Column = "name"; Type = ColumnsType.Name }
                    { Name = "Datum"; Column = "time"; Type = ColumnsType.Time }
                    { Name = "Größe"; Column = "size"; Type = ColumnsType.Size }
                |] else 
                    None
    |}
    return JsonSerializer.Serialize (result, getJsonOptions ())
}


module Directory
open System
open System.Diagnostics
open System.IO
open System.Runtime.InteropServices
open FSharpTools
open FSharpTools.TaskResult
open ClrWinApi
open Types
open RequestResult

let mount path = path

let getIconPath (info: FileInfo) =
    match 
        info.Extension
        |> Option.checkNull 
        with
        | Some ext when String.icompare ext ".exe" = 0 -> info.FullName
        | Some ext when ext.Length > 0 -> ext
        | _ -> ".noextension"

let getAdditionalInfo path = 
    let mapVersion (version: FileVersionInfo) = 
        {
            Major = version.FileMajorPart
            Minor = version.FileMinorPart
            Patch = version.FilePrivatePart
            Build = version.FileBuildPart
        }
    
    FileVersionInfo.GetVersionInfo path
    |> Option.checkNull
    |> Option.map mapVersion

let onEnter (param: OnEnterParam) =
    let alt = param.Keys |> Option.map(fun n -> n.Alt) |> Option.defaultValue false
    let ctrl = param.Keys |> Option.map(fun n -> n.Ctrl) |> Option.defaultValue false
    if alt || ctrl then 
        let mutable info = ShellExecuteInfo()
        info.Size <- Marshal.SizeOf(info)
        info.Verb <- if alt then "properties" else "openas"
        info.File <- param.Path
        info.Show <- ShowWindowFlag.Show
        info.Mask <- ShellExecuteFlag.InvokeIDList
        Api.ShellExecuteEx(ref info) |> ignore    
    else 
        use proc = new Process()
        proc.StartInfo <- ProcessStartInfo(param.Path)
        proc.StartInfo.UseShellExecute <- true
        proc.Start() |> ignore
    returnReqNone ()

let doDeleteItems path names  = 
    let deleteItems path names  = 
        let mutable fileOperation = ShFileOPStruct()
        fileOperation.Func <- FileFuncFlags.DELETE
        fileOperation.From <- String.Join("\U00000000", names |> Array.map (Directory.combine2Pathes path)) + "\U00000000\U00000000"
        fileOperation.Flags <- FileOpFlags.NOCONFIRMATION 
                                ||| FileOpFlags.NOERRORUI
                                ||| FileOpFlags.NOCONFIRMMKDIR
                                ||| FileOpFlags.SILENT
                                ||| FileOpFlags.ALLOWUNDO
        match Api.SHFileOperation fileOperation with
        | 0 -> Ok ()
        | 2 -> Error IOError.FileNotFound
        | 0x78 -> Error IOError.AccessDenied
        | _ -> Error IOError.Exn
    task {
        return 
            deleteItems path names
            |> Result.mapError fromIOError    
    }

let deleteItems (input: DeleteItemsParam) = 
    doDeleteItems input.Path input.Names 
    |> toTaskResultAwait

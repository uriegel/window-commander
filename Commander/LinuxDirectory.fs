module PlatformDirectory

open Configuration

open System.Diagnostics
open System.IO

let private getIconScript = 
    let filename = saveResource (getElectronFile "geticon.py", "python/geticon.py")
    let getIconScript () = filename
    getIconScript

let getIconPath (fileInfo: FileInfo) = 
    match fileInfo.Extension with
    | ext when ext |> String.length > 0 -> ext
    | _                                 -> ".noextension"

let getIcon ext = 
    let mutable output = ""
    try 
        use proc = new Process() 
        proc.StartInfo <- ProcessStartInfo()
        proc.StartInfo.RedirectStandardOutput <- true
        proc.StartInfo.RedirectStandardError <- true
        proc.StartInfo.FileName <- "python3"
        proc.StartInfo.CreateNoWindow <- true
        proc.StartInfo.Arguments <- sprintf "%s %s" (getIconScript ()) ext
        proc.EnableRaisingEvents <- true
        proc.OutputDataReceived.Add(fun data -> if data.Data <> null then output <- data.Data)
        proc.ErrorDataReceived.Add(fun data -> eprintfn "%s" data.Data)
        proc.Start() |> ignore
        proc.BeginOutputReadLine();
        proc.BeginErrorReadLine();
        proc.EnableRaisingEvents <- true
        proc.WaitForExit ()
    with
        | _ as e -> eprintfn "%s" <| e.ToString ()
    output

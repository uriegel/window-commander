module Electron

open FSharpTools
open System
open System.Text.Json
open System.Threading

open Configuration
open PlatformConfiguration
open Theme

let isLinux = Environment.OSVersion.VersionString |> String.startsWith "Unix" 

let start args = 
    saveResource (getElectronFile "appicon.ico", appicon) |> ignore
    async {
        try 
            use proc = new Diagnostics.Process() 
            proc.StartInfo <- Diagnostics.ProcessStartInfo()
            proc.StartInfo.RedirectStandardOutput <- true
            proc.StartInfo.RedirectStandardInput <- true
            proc.StartInfo.RedirectStandardError <- true
            proc.StartInfo.FileName <- if isLinux then "electron" else "electron.cmd"
            proc.StartInfo.CreateNoWindow <- true
            proc.StartInfo.Environment.Add("Bounds", JsonSerializer.Serialize (getBounds <| getTheme (), getJsonOptions ()))
            proc.StartInfo.Arguments <- args
            proc.EnableRaisingEvents <- true
            proc.OutputDataReceived.Add(fun data -> printfn "%s" data.Data)
            proc.ErrorDataReceived.Add(fun data -> eprintfn "%s" data.Data)
            proc.Start() |> ignore
            proc.BeginOutputReadLine();
            proc.BeginErrorReadLine();
            proc.EnableRaisingEvents <- true
            do! proc.WaitForExitAsync CancellationToken.None |> Async.AwaitTask
        with
            | _ as e -> eprintfn "%s" <| e.ToString ()
    }

    
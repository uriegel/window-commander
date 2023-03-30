#if Linux

using Microsoft.AspNetCore.Http;

using AspNetExtensions;
using CsTools.Extensions;
using GtkDotNet;
using LinqTools;

using static CsTools.Core;

static partial class Directory
{
    public static string GetIconPath(FileInfo info)
        => info.Extension?.Length > 0 ? info.Extension : ".noextension";

    public static Task ProcessIcon(HttpContext context, string iconHint)
        => RepeatOnException(async () => 
            await WebWindowNetCore.WebView.GtkApplication!.Dispatch(async () =>
                {
                    using var iconInfo = IconInfo.Choose(iconHint, 16, IconLookup.ForceSvg);
                    var iconFile = iconInfo.GetFileName();
                    using var stream = iconFile?.OpenFile();
                    await context.SendStream(stream!, startTime, iconFile);
                }, 100), 
            1);

    public static Task<GetExtendedItemsResult> GetExtendedItems(GetExtendedItems getExtendedItems)
        => GetExtendedItems(getExtendedItems.Path, getExtendedItems.Items)
            .ToAsync();

    public static Task<IOResult> DeleteItems(DeleteItemsParam input)
        => LinqTools.Core.TryAsync<Nothing, IOError>(
            () => WebWindowNetCore.WebView.GtkApplication!.Dispatch(() =>
                {
                    input.Names.ForEach(n => GFile.Trash(input.Path.AppendPath(n)));
                    return 0.ToNothing();
                }, 100),
            MapExceptionToIOError)
            .ToIOResult();        

    static void CopyItem(string name, string path, string targetPath, Action<long, long> progress, bool move, CancellationToken cancellationToken)
        => Copy(path.AppendPath(name), targetPath.AppendPath(name), FileCopyFlags.Overwrite,
                (c, t) => progress(c, t), move, cancellationToken);

    static void Copy(string source, string target, FileCopyFlags flags, GFile.ProgressCallback cb, bool move,
        CancellationToken cancellationToken)
    {
        if (move)
            GtkDotNet.GFile.Move(source, target, flags, true, cb);
        else
            GtkDotNet.GFile.Copy(source, target, flags, true, cb);
    }

    static IOError MapExceptionToIOError(Exception e)
        => e switch
        {
            UnauthorizedAccessException ue                     => IOError.AccessDenied,
            GtkDotNet.GErrorException gee  when gee.Code ==  1 => IOError.FileNotFound, 
            GtkDotNet.GErrorException gee  when gee.Code == 14 => IOError.DeleteToTrashNotPossible, // TODO or IOError.AccessDenied
            _                                                  => IOError.Exn
        };

    static readonly DateTime startTime = DateTime.Now;
}

record GetExtendedItemsResult(
    DateTime?[] ExifTimes,
    string Path
);

#endif

    // TODO KDE
    // let getKdeIcon ext = async {
    //     let extractMime str = 
    //         let pos1 = str |> String.indexOf "('" 
    //         let pos2 = str |> String.indexOf "',"
    //         match pos1, pos2 with
    //         | Some pos1, Some pos2 
    //             -> Some (str |> String.substring2 (pos1+2) (pos2-pos1-2))
    //         | _ -> None

    //     let replaceSlash str = Some (str |> String.replaceChar  '/' '-')
    //     let getMime = extractMime >=> replaceSlash

    //     let mapVarious mime =
    //         match mime with
    //         | "/usr/share/icons/breeze/mimetypes/16/application-x-msdos-program.svg" 
    //                         -> "/usr/share/icons/breeze/mimetypes/16/application-x-ms-dos-executable.svg"
    //         | "/usr/share/icons/breeze/mimetypes/16/application-java-archive.svg"    
    //                         -> "/usr/share/icons/breeze/mimetypes/16/application-x-jar.svg"
    //         | s     -> s

    //     let! mimeType = asyncRunCmd "python3" (sprintf "%s *%s" (getIconScript ()) ext)

    //     let icon = 
    //         sprintf "/usr/share/icons/breeze/mimetypes/16/%s.svg" (mimeType |> getMime |> defaultValue "application-x-zerosize")
    //         |> mapVarious
    //         |> getExistingFile
    //         |> Option.defaultValue "/usr/share/icons/breeze/mimetypes/16/application-x-zerosize.svg"
    //     return icon, "image/svg+xml"
    // }

//     return! 
//         match getPlatform () with
// //        | Platform.Kde -> getKdeIcon ext
//         | _            -> async { return getIcon ext, "image/png" }

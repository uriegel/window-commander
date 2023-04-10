using System.Net.Http.Json;

using CsTools.Extensions;
using CsTools.HttpRequest;
using LinqTools;
using LinqTools.Async;

using static CsTools.HttpRequest.Core;
using static AspNetExtensions.Core;
using System.Text.Json;
using CsTools;

static class Remote
{
    public static Task<GetFilesResult> GetFiles(GetFiles getFiles)
        => (from n in Request.GetStringAsync(
                getFiles
                    .Path
                    .GetIpAndPath()
                    .GetFiles())
            select JsonSerializer
                    .Deserialize<RemoteItem[]>(n, JsonWebDefaults)
                    .GetOrDefault(Array.Empty<RemoteItem>())
                    .Select(ToDirectoryItem))
                        .Select(n => n.Where(n => getFiles.ShowHiddenItems ? true : !n.IsHidden).ToArray()
                        .ToFilesResult(getFiles.Path));

    public static Task<IOResult> CopyItemsFromRemote(CopyItemsParam input)
        => CopyItemsFromRemote(input.Path.GetIpAndPath(), input.TargetPath, input.Items, input.Move)
                .Catch(MapExceptionToIOResult);

    public static Task<IOResult> CopyItemsToRemote(CopyItemsParam input)
        => CopyItemsToRemote(input.Path,  input.TargetPath.GetIpAndPath(), input.Items, input.Move)
                .Catch(MapExceptionToIOResult);

    static Settings GetFiles(this IpAndPath ipAndPath)
    => DefaultSettings with
        {
            Method = HttpMethod.Post,
            BaseUrl = $"http://{ipAndPath.Ip}:8080",
            Url = "/getfiles",
            AddContent = () => JsonContent.Create(new { Path = ipAndPath.Path })
        };

    static Settings GetFile(this IpAndPath ipAndPath, string name) 
        => DefaultSettings with
        {
            Method = HttpMethod.Post,
            BaseUrl = $"http://{ipAndPath.Ip}:8080",
            Url = "/getfile",
            AddContent = () => JsonContent.Create(new 
                                { 
                                    Path = ipAndPath.Path.AppendLinuxPath(name) 
                                })
        };

    static Settings PostFile(this IpAndPath ipAndPath, string name, Stream streamToPost) 
        => DefaultSettings with
        {
            Method = HttpMethod.Post,
            BaseUrl = $"http://{ipAndPath.Ip}:8080",
            Url = $"/postfile?path={ipAndPath.Path.AppendLinuxPath(name)}",
            AddContent = () => new StreamContent(streamToPost, 8100)
        };

    static DirectoryItem ToDirectoryItem(this RemoteItem item)
        => new(
                item.Name, 
                item.Size, 
                item.IsDirectory, 
                null, 
                item.IsHidden, 
                item.Time.FromUnixTime()
            );
    static GetFilesResult ToFilesResult(this DirectoryItem[] items, string path)
        => new GetFilesResult(items, path, items.Where(n => n.IsDirectory).Count(), items.Where(n => !n.IsDirectory).Count());

    static IpAndPath GetIpAndPath(this string url)
        => new(url.StringBetween('/', '/'), "/" + url.SubstringAfter('/').SubstringAfter('/'));

    static async Task<IOResult> CopyItemsFromRemote(IpAndPath ipAndPath, string targetPath, CopyItem[] items, bool move)
        => await CopyItems(items
                        .Select(n => n.Size)
                        .Aggregate(0L, (a, b) => a + b), 
                    ipAndPath, targetPath, items, move, Cancellation.Create());

    static async Task<IOResult> CopyItemsToRemote(string sourcePath, IpAndPath ipAndPath, CopyItem[] items, bool move)
        => await CopyItems(items
                        .Select(n => n.Size)
                        .Aggregate(0L, (a, b) => a + b), 
                    sourcePath, ipAndPath, items, move, Cancellation.Create());

    static async Task<IOResult> CopyItems(long totalSize, IpAndPath ipAndPath, string targetPath, CopyItem[] items, bool move, CancellationToken cancellationToken)
        => (await items.ToAsyncEnumerable().AggregateAwaitAsync(0L, async (count, n) =>
        {
            if (cancellationToken.IsCancellationRequested)
                return 0;
            var targetFilename = targetPath.AppendLinuxPath(n.Name);
            using var msg = await Request.RunAsync(ipAndPath.GetFile(n.Name), true);
            using var targetFile = 
                File
                    .Create(targetFilename)
                    .WithProgress((c, t) => Events.CopyProgressChanged(new(
                        n.Name, 
                        msg.Content.Headers.ContentLength.GetOrDefault(0), 
                        c, 
                        totalSize, count + c
                    )));

            await msg 
                .Content
                .ReadAsStream()
                .CopyToAsync(targetFile, cancellationToken);
            msg
                .GetHeaderLongValue("x-file-date")
                .WhenSome(v => v
                                .SideEffect(_ => targetFile.Close())
                                .SetLastWriteTime(targetFilename));

            return count + n.Size;
        }))
            .ToIOResult();

    static async Task<IOResult> CopyItems(long totalSize, string sourcePath, IpAndPath ipAndPath, CopyItem[] items, bool move, CancellationToken cancellationToken)
        => (await items.ToAsyncEnumerable().AggregateAwaitAsync(0L, async (count, n) =>
        {
            if (cancellationToken.IsCancellationRequested)
                return 0;
            var sourceFilename = sourcePath.AppendPath(n.Name);
            using var sourceFile = 
                File
                    .OpenRead(sourceFilename)
                    .WithProgress((c, t) => Events.CopyProgressChanged(new(
                        n.Name, 
                        n.Size, 
                        c, 
                        totalSize, count + c
                    )));
            using var msg = await Request.RunAsync(ipAndPath.PostFile(n.Name, sourceFile), true);

            // TODO set x-file-date
            // msg
            //     .GetHeaderLongValue("x-file-date")
            //     .WhenSome(v => v
            //                     .SideEffect(_ => targetFile.Close())
            //                     .SetLastWriteTime(targetFilename));

            return count + n.Size;
        }))
            .ToIOResult();

    static void SetLastWriteTime(this long unixTime, string targetFilename)
        => File.SetLastWriteTime(targetFilename, unixTime.FromUnixTime());

    static IOResult ToIOResult<T>(this T t)
        => (new IOResult(null));

    // TODO Exceptions
    // TODO No action when another action is waiting because of connection lost
    static IOError MapExceptionToIOError(Exception e)
        => e switch
        {
            UnauthorizedAccessException ue                     => IOError.AccessDenied,
            _                                                  => IOError.Exn
        };

    static IOResult MapExceptionToIOResult(Exception e)
        => new(MapExceptionToIOError(e));

    static string AppendLinuxPath(this string path, string pathToAppend)
        => path.EndsWith('/')
            ? path + pathToAppend
            : path + '/' + pathToAppend;
}
record RemoteItem(
    string Name,
    long Size,
    bool IsDirectory,
    bool IsHidden,
    long Time
);

record IpAndPath(
    string Ip,
    string Path
);
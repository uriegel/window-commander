const fspath = require('path')
const { rmdir } = require('fs/promises')
const { getFiles } = require('filesystem-utilities')

async function deleteEmptyFolders(path, folders) {
    const folderPathes = folders.map(n => fspath.join(path, n))

    async function getSubDirs(path) {
        path = fspath.normalize(path).replace(":.", ":\\")
        return (await getFiles(path))
            .filter(n => n.isDirectory)
            .map(n => fspath.join(path, n.name))
    }
    
    async function removeDirectory(folderPath) {
        var items = await getSubDirs(folderPath)
        if (items.length > 0) {
            try {
                await Promise.all(items.map(removeDirectory))
            } catch (err)  {
                console.log("error while deleting empty folders", err)
            }
        }
        try {
            await rmdir(folderPath)
        } catch (err)  {
            console.log("error while deleting empty folder", err)
        }
    }

    try {
        await Promise.all(folderPathes.map(removeDirectory))
    } catch (err)  {
        console.log("error while deleting empty folders", err)
    }
}

exports.deleteEmptyFolders = deleteEmptyFolders
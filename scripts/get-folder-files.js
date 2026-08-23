/* eslint-disable */
const fs = require("node:fs");
const { parseArgs, collectFolderFiles } = require("./lib");

const { ids: folderIds, filters } = parseArgs(process.argv.slice(2));

(async () => {
  const allFiles = [];
  const promises = [];

  for (const folderId of folderIds) {
    try {
      const folderResults = await collectFolderFiles(
        folderId,
        null,
        filters,
        promises,
      );
      allFiles.push(...folderResults);
    } catch (error) {
      throw error;
    }
  }

  Promise.all(promises).then(() => {
    fs.writeFileSync(__dirname + "/../files.json", JSON.stringify(allFiles, null, 2));
  });
})();

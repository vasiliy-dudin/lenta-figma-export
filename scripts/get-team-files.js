/* eslint-disable */
const fs = require("node:fs");
const { getFolders, parseArgs, collectFolderFiles } = require("./lib");

const { ids: teamIds, filters } = parseArgs(process.argv.slice(2));

(async () => {
  const allFiles = [];
  const promises = [];

  for (const teamId of teamIds) {
    try {
      const folderData = await getFolders(teamId);
      const folders = folderData.folders || folderData.projects || [];

      for (const folder of folders) {
        const folderResults = await collectFolderFiles(
          folder.id,
          teamId,
          filters,
          promises,
          folder.name,
        );
        allFiles.push(...folderResults);
      }
    } catch (error) {
      throw error;
    }
  }

  Promise.all(promises).then(() => {
    fs.writeFileSync(__dirname + "/../files.json", JSON.stringify(allFiles, null, 2));
  });
})();


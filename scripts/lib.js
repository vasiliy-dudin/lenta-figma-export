/* eslint-disable */
const dotenv = require("dotenv");

dotenv.config();

const params = {
  method: "GET",
  headers: {
    "X-FIGMA-TOKEN": process.env.FIGMA_ACCESS_TOKEN,
  },
};

async function getFolders(teamId) {
  try {
    const response = await fetch(
      `https://api.figma.com/v2/teams/${teamId}/folders`,
      params,
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.err || data.message);
    }

    return data;
  } catch (error) {
    throw error;
  }
}

async function getSubfolders(folderId) {
  try {
    const response = await fetch(
      `https://api.figma.com/v2/folders/${folderId}/folders`,
      params,
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.err || data.message);
    }

    return data;
  } catch (error) {
    throw error;
  }
}

async function getFolderFiles(folderId) {
  try {
    const response = await fetch(
      `https://api.figma.com/v2/folders/${folderId}/files`,
      params,
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.err || data.message);
    }

    return data;
  } catch (error) {
    throw error;
  }
}

async function getFolderMeta(folderId) {
  try {
    const response = await fetch(
      `https://api.figma.com/v2/folders/${folderId}/meta`,
      params,
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.err || data.message);
    }

    return data;
  } catch (error) {
    throw error;
  }
}

function parseArgs(argv) {
  const ids = [];
  const filters = {};

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "-last-modified-before") {
      const value = argv[++i];
      if (!value || isNaN(Date.parse(value))) {
        throw new Error(
          `Invalid or missing value for -last-modified-before: ${value}`,
        );
      }
      filters.before = new Date(value);
    } else if (arg === "-last-modified-after") {
      const value = argv[++i];
      if (!value || isNaN(Date.parse(value))) {
        throw new Error(
          `Invalid or missing value for -last-modified-after: ${value}`,
        );
      }
      filters.after = new Date(value);
    } else if (!arg.startsWith("-")) {
      ids.push(arg);
    }
  }

  return { ids, filters };
}

function filterFiles(filesData, filters) {
  if (!filters.before && !filters.after) {
    return filesData;
  }

  if (!filesData.files || !Array.isArray(filesData.files)) {
    return filesData;
  }

  filesData.files = filesData.files.filter((file) => {
    const lastModified = new Date(file.last_modified);
    if (filters.before && lastModified >= filters.before) {
      return false;
    }
    if (filters.after && lastModified <= filters.after) {
      return false;
    }
    return true;
  });

  return filesData;
}

async function collectFolderFiles(folderId, teamId, filters, promises, folderNameHint = null) {
  const results = [];

  const filesPromise = getFolderFiles(folderId).then((data) =>
    filterFiles(data, filters),
  );
  if (promises) promises.push(filesPromise);

  const folderFilesData = await filesPromise;
  folderFilesData.id = folderId;
  if (teamId) {
    folderFilesData.team_id = teamId;
  }
  if (!folderFilesData.name && folderNameHint) {
    folderFilesData.name = folderNameHint;
  }

  console.log(folderFilesData);
  results.push(folderFilesData);

  try {
    const subfoldersData = await getSubfolders(folderId);
    const subfolders = subfoldersData.folders || subfoldersData.subfolders || [];
    for (const subfolder of subfolders) {
      const subResults = await collectFolderFiles(
        subfolder.id,
        teamId,
        filters,
        promises,
        subfolder.name,
      );
      results.push(...subResults);
    }
  } catch (error) {
    // Continue if no subfolders or subfolder fetch fails
  }

  return results;
}

exports.getFolders = getFolders;
exports.getSubfolders = getSubfolders;
exports.getFolderFiles = getFolderFiles;
exports.getFolderMeta = getFolderMeta;
exports.parseArgs = parseArgs;
exports.filterFiles = filterFiles;
exports.collectFolderFiles = collectFolderFiles;

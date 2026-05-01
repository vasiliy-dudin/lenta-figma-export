import { test } from "@playwright/test";
import fs from "node:fs";
import dotenv from "dotenv";

dotenv.config();

const projects = JSON.parse(
  fs.readFileSync("files.json", { encoding: "utf-8" }),
);

const allFiles: { project: any; file: any }[] = projects.flatMap((project: any) =>
  project.files.map((file: any) => ({ project, file })),
);

const batchIndex = process.env.BATCH_INDEX !== undefined ? Number(process.env.BATCH_INDEX) : null;
const batchSize = process.env.BATCH_SIZE !== undefined ? Number(process.env.BATCH_SIZE) : null;

const filesToDownload =
  batchIndex !== null && batchSize !== null
    ? allFiles.slice(batchIndex * batchSize, (batchIndex + 1) * batchSize)
    : allFiles;

if (filesToDownload.length === 0) {
  test.skip(`batch ${batchIndex} is empty — no files to download`, () => {});
}

const fileKeysByProject = new Map<string, Set<string>>();
for (const { project, file } of filesToDownload) {
  if (!fileKeysByProject.has(project.id)) fileKeysByProject.set(project.id, new Set());
  fileKeysByProject.get(project.id)!.add(file.key);
}

for (const project of projects) {
  const allowedKeys = fileKeysByProject.get(project.id);
  if (!allowedKeys) continue;

  const projectName = project.name || "Drafts";
  const teamId = project.team_id || null;

  test.describe(`project: ${projectName} (${project.id})`, () => {
    for (const file of project.files.filter((f: any) => allowedKeys.has(f.key))) {
      test(`file: ${file.name} (${file.key})`, async ({ page }) => {
        await page.goto(`https://www.figma.com/design/${file.key}/`);

        const downloadPromise = page.waitForEvent("download");

        await page.locator("#toggle-menu-button").click();
        await page.locator("[id^='mainMenu-file-menu-']").click();
        await page.locator("[id^='mainMenu-save-as-']").click();

        const download = await downloadPromise;
        const suggestedFilename = download.suggestedFilename();
        const filename = suggestedFilename.match(/.*(?=\.[\w\d]+)/)![0];
        const extension = suggestedFilename.replace(filename + ".", "");
        await download.saveAs(
          `${process.env.DOWNLOAD_PATH!}/${teamId ? teamId + "/" : ""}${projectName} (${project.id})/${filename} (${file.key}).${extension}`,
        );

        await page.waitForTimeout(Number(process.env.WAIT_TIMEOUT) || 10000);
      });
    }
  });
}

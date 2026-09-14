# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Purpose

Automated weekly backup of Figma/FigJam files for a single company. Runs headless on a Linux server via cron. Uses Playwright to log into Figma and trigger the native "Save as" download for each file listed in `files.json`.

## Commands

```bash
# Install dependencies and Chromium
pnpm install

# Fetch files for all company teams, traversing subfolders (outputs files.json)
pnpm run get-team-files -- <teamId1> <teamId2> ...

# Fetch files for specific folders only, traversing subfolders
pnpm run get-folder-files -- <folderId1> <folderId2> ...

# Run the export (auth → download); downloads only files not yet marked "downloaded"
pnpm start

# Force re-download of every file, ignoring the "downloaded" tracking flag
pnpm run start:force

# Download at most N pending files, then stop
pnpm start -- -limit <N>

# Retry only failed downloads
pnpm run retry

# List all tests without running them
pnpm run dry-run

# Open HTML test report
pnpm run report
```

To run a single Playwright test by name:
```bash
npx playwright test --grep "file: FileName"
```

## Architecture

The tool has two distinct phases:

**1. File discovery (scripts/)** — Node.js scripts that call the Figma REST API (`v2/teams/{id}/folders`, `v2/folders/{id}/files`, `v2/folders/{id}/folders`) using `FIGMA_ACCESS_TOKEN`. They accept team or folder IDs as CLI arguments, recurse into subfolders, and write a `files.json` manifest. This step is run manually when the file list needs updating, not on every backup run. `-last-modified-before <date>` / `-last-modified-after <date>` filter the files collected by last-modified date.

**2. Download automation (automations/)** — Playwright drives a real Chromium browser session:
- `auth.setup.ts` runs first: either injects `FIGMA_AUTH_COOKIE` directly or performs email/password login, then saves session state to `.auth/user.json`.
- `download.spec.ts` reads `files.json`, generates one Playwright test per pending file at runtime (inside a `for` loop at module load time; a file is "pending" unless it already has `"downloaded": true`, or `-force`/`FORCE=true` is set), dismisses the "desktop app / installed fonts" dialog if it appears, navigates to each file, and triggers File → Save local copy to capture the browser download event. Files are saved to `DOWNLOAD_PATH/{teamId}/{folderName} ({folderId})/{filename} ({fileKey}).{ext}`. After each successful download, the file's entry in `files.json` is updated in place with `"downloaded": true` and the manifest is rewritten to disk — so a re-run automatically resumes from where a failed or interrupted run left off.
- `playwright.config.ts` checks `files.json` before starting the browser at all; if every file is already `downloaded` (and `-force` wasn't passed), it logs `No pending files to download.` and exits immediately instead of launching Chromium.

**Playwright project order:** `setup` runs before `download` (configured via `dependencies` in `playwright.config.ts`). Single worker, no parallelism — downloads are sequential.

**Timeout:** `WAIT_TIMEOUT` (default 10 000 ms) is added as a deliberate delay between downloads to avoid rate-limiting. The Playwright `timeout` is `WAIT_TIMEOUT + 120s`.

## Environment Variables

Defined in `.env`:

| Variable | Purpose |
|---|---|
| `FIGMA_AUTH_COOKIE` | Value of `__Host-figma.authn` cookie — preferred auth method |
| `FIGMA_EMAIL` / `FIGMA_PASSWORD` | Fallback login credentials |
| `FIGMA_ACCESS_TOKEN` | API token for discovery scripts only — needs the `folders:read` scope for the v2 endpoints |
| `DOWNLOAD_PATH` | Absolute path where `.fig` files are saved |
| `WAIT_TIMEOUT` | Delay in ms between downloads (default: 10000) |

`FIGMA_AUTH_COOKIE` is preferred on the server because it avoids the two-step email login flow.

## Weekly Backup (cron)

Figma triggers CAPTCHA after too many downloads in one session, so the weekly backup is still split across several days — but the split now comes from the built-in download-tracking flag and `-limit`, not from manually sliced batches:

```
# /etc/cron.d/figma-backup  (or user crontab)
0 2 * * 1  cd /path/to/project && pnpm run get-team-files -- $(cat teams.md) -last-modified-after "$(date -d '7 days ago' +%F)" && pnpm start -- -limit <N>
0 3 * * 2  cd /path/to/project && pnpm start -- -limit <N>
0 4 * * 3  cd /path/to/project && pnpm start
```

- Monday regenerates `files.json` from scratch (so no file carries a stale `downloaded` flag from the previous cycle) restricted to files changed in the last 7 days, then downloads the first `<N>` of them.
- Tuesday and Wednesday reuse the same `files.json`; each run picks up only files still missing `"downloaded": true`, so a file that failed or was rate-limited on Monday is retried automatically.
- Wednesday has no `-limit`, so it drains whatever is left; if nothing is pending, `playwright.config.ts` exits immediately without opening a browser.
- `<N>` needs empirical tuning against Figma's rate limits — the previous "~50 files total" estimate in this doc did not match the manifest's actual size (2944 files across 43 folders as of the last discovery run), so do not reuse the old `17`-per-day figure without re-measuring.

## Company Team IDs

All Figma team IDs for this company are stored in `teams.md` (space-separated). Use these as arguments to `get-team-files` when regenerating `files.json`.

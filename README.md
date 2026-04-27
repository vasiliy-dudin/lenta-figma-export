# figma-export

Automated weekly backup of Figma/FigJam files. Runs headless on a Linux server via cron. Uses Playwright to log into Figma and trigger the native "Save as" download for each file in `files.json`.

## Setup

```bash
pnpm install          # installs dependencies and Chromium
cp .env.example .env  # fill in credentials
```

## Usage

```bash
# Discover files and write files.json
pnpm run get-team-files <teamId1> <teamId2> ...
pnpm run get-project-files <projectId1> <projectId2> ...

# Run the full backup (auth → download)
pnpm start

# Retry only failed downloads
pnpm run retry

# List all tests without downloading
pnpm run dry-run
```

## Environment Variables

| Variable | Purpose |
|---|---|
| `FIGMA_AUTH_COOKIE` | Value of `__Host-figma.authn` cookie — preferred auth method |
| `FIGMA_EMAIL` / `FIGMA_PASSWORD` | Fallback login credentials |
| `FIGMA_ACCESS_TOKEN` | API token for `get-team-files` / `get-project-files` only |
| `DOWNLOAD_PATH` | Absolute path where `.fig` files are saved |
| `WAIT_TIMEOUT` | Delay in ms between downloads (default: 10000) |
| `BATCH_INDEX` | Zero-based index of the batch to download. Omit to download all files. |
| `BATCH_SIZE` | Number of files per batch. Used together with `BATCH_INDEX`. |

`FIGMA_AUTH_COOKIE` is preferred on the server — it skips the two-step email login flow.

## Batched Backup via cron

Figma triggers CAPTCHA after too many downloads in one session. Split the backup into batches of ~17 files with 25-hour gaps between them:

```
# /etc/cron.d/figma-backup
0 2 * * 1  cd /path/to/project && BATCH_INDEX=0 BATCH_SIZE=17 pnpm start
0 3 * * 2  cd /path/to/project && BATCH_INDEX=1 BATCH_SIZE=17 pnpm start
0 4 * * 3  cd /path/to/project && BATCH_INDEX=2 BATCH_SIZE=17 pnpm start
0 5 * * 4  cd /path/to/project && BATCH_INDEX=3 BATCH_SIZE=17 pnpm start  # enable when >51 files
```

The full cycle (3 batches × ~17 files) completes by Wednesday. A new cycle starts the following Monday.

`BATCH_INDEX` and `BATCH_SIZE` are passed as inline env vars per cron entry — do not set them in `.env`.

## How It Works

**1. File discovery** — `scripts/` contains Node.js scripts that call the Figma REST API and write a `files.json` manifest. Run manually when the file list changes.

**2. Download** — Playwright drives a real Chromium session. `auth.setup.ts` injects the auth cookie (or logs in via email/password) and saves session state to `.auth/user.json`. `download.spec.ts` reads `files.json`, navigates to each file, and triggers File → Save As. Files are saved to:

```
DOWNLOAD_PATH/{teamId}/{projectName} ({projectId})/{filename} ({fileKey}).{ext}
```

Downloads are sequential (single worker). `WAIT_TIMEOUT` adds a deliberate delay between downloads to avoid rate-limiting.

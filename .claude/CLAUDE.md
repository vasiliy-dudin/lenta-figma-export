# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Purpose

Automated weekly backup of Figma/FigJam files for a single company. Runs headless on a Linux server via cron. Uses Playwright to log into Figma and trigger the native "Save as" download for each file listed in `files.json`.

## Commands

```bash
# Install dependencies and Chromium
pnpm install

# Fetch files for all company teams (outputs files.json)
pnpm run get-team-files <teamId1> <teamId2> ...

# Fetch files for specific projects only
pnpm run get-project-files <projectId1> <projectId2> ...

# Run the full export (auth → download)
pnpm start

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

**1. File discovery (scripts/)** — Node.js scripts that call the Figma REST API using `FIGMA_ACCESS_TOKEN`. They accept team or project IDs as CLI arguments and write a `files.json` manifest. This step is run manually when the file list needs updating, not on every backup run.

**2. Download automation (automations/)** — Playwright drives a real Chromium browser session:
- `auth.setup.ts` runs first: either injects `FIGMA_AUTH_COOKIE` directly or performs email/password login, then saves session state to `.auth/user.json`.
- `download.spec.ts` reads `files.json`, generates one Playwright test per file at runtime (inside a `for` loop at module load time), navigates to each file, and triggers File → Save As to capture the browser download event. Files are saved to `DOWNLOAD_PATH/{teamId}/{projectName} ({projectId})/{filename} ({fileKey}).{ext}`.

**Playwright project order:** `setup` runs before `download` (configured via `dependencies` in `playwright.config.ts`). Single worker, no parallelism — downloads are sequential.

**Timeout:** `WAIT_TIMEOUT` (default 10 000 ms) is added as a deliberate delay between downloads to avoid rate-limiting. The Playwright `timeout` is `WAIT_TIMEOUT + 120s`.

## Environment Variables

Defined in `.env` (copy from `.env.example`):

| Variable | Purpose |
|---|---|
| `FIGMA_AUTH_COOKIE` | Value of `__Host-figma.authn` cookie — preferred auth method |
| `FIGMA_EMAIL` / `FIGMA_PASSWORD` | Fallback login credentials |
| `FIGMA_ACCESS_TOKEN` | API token for discovery scripts only |
| `DOWNLOAD_PATH` | Absolute path where `.fig` files are saved |
| `WAIT_TIMEOUT` | Delay in ms between downloads (default: 10000) |

`FIGMA_AUTH_COOKIE` is preferred on the server because it avoids the two-step email login flow.

## Company Team IDs

All Figma team IDs for this company are stored in `teams.md` (space-separated). Use these as arguments to `get-team-files` when regenerating `files.json`.

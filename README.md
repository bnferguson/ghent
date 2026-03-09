# GHENT — GitHub Email Notifications Tamer

A Google Apps Script that tames your GitHub notification emails by automatically labeling them by reason and repo, then archiving them out of your inbox. Spiritual successor to [OctoGAS](https://github.com/btoews/OctoGAS).

## What it does

**Labeler** — Every 5 minutes, GHENT scans your inbox for GitHub notification emails, applies labels, and archives them. You triage by label instead of wading through a noisy inbox.

Labels are applied at the **thread level**. A PR thread will accumulate bot comments, push notifications, review requests, and mentions over its lifetime. GHENT scans all messages in the thread and applies the **highest-priority reason** as the label:

| Priority | Label | You got this because... |
|---|---|---|
| 1 | `GHENT/Mention` | Someone @mentioned you |
| 2 | `GHENT/Review Requested` | Your review was requested (manual or CODEOWNERS) |
| 3 | `GHENT/Assigned` | You were assigned |
| 4 | `GHENT/Author` | You authored the PR/issue (or commented/changed state) |
| 5 | `GHENT/Team Mention` | Your team was @mentioned |
| 6 | `GHENT/CI` | CI activity |
| 7 | `GHENT/Subscribed` | You're watching the repo or manually subscribed |

Each thread also gets a **repo label** like `GHENT/Repos/my-repo`, so you can triage by project.

When a thread gets new activity and lands back in your inbox, GHENT re-evaluates it — if the reason upgraded (e.g., you were just subscribed but now you got @mentioned), the old reason label is replaced.

**Muter** — When you mute a GitHub thread in Gmail, GHENT automatically unsubscribes you from the GitHub notification thread, then unmutes the Gmail thread. This way, if someone @mentions you again later, GitHub will re-subscribe you and you'll get the email.

## Installation

### 1. Create the Apps Script project

```bash
npm install
npx @google/clasp login    # Authenticate with Google (opens browser)
npx @google/clasp create --type standalone --title "GHENT" --rootDir src
npx @google/clasp push --force
```

Or copy the contents of `src/` into a new project at [script.google.com](https://script.google.com).

### 2. Authorize and activate

1. Open the script editor: visit the URL printed by `clasp create`, or find "GHENT" at [script.google.com](https://script.google.com)
2. Select `main.js` from the file list
3. In the function dropdown, select `install`
4. Click Run
5. Approve the permissions when prompted (see [Permissions](#permissions) below)

### 3. Verify

Run the `run` function manually to process your current inbox. Check the execution log for output like:

```
GHENT: Processed 50 threads so far
GHENT: Processed 100 threads so far
GHENT: Done. Processed 142 threads total
```

## Permissions

GHENT requests three OAuth scopes. Here's what each one does and why it's needed:

| Permission | OAuth Scope | Why |
|---|---|---|
| **Read, compose, and modify Gmail** | `gmail.modify` | Read notification emails, apply labels, and archive threads. This is the core of what GHENT does. |
| **Manage Gmail labels** | `gmail.labels` | Create and manage the label hierarchy (reason labels, repo labels). |
| **Connect to an external service** | `script.external_request` | The muter calls GitHub's unsubscribe URL (`github.com/notifications/unsubscribe/...`) when you mute a thread in Gmail. No data is sent — it's a simple GET request to unsubscribe. |
| **Manage triggers** | `script.scriptapp` | Create and delete time-based triggers so GHENT runs automatically every 5 minutes. |

No org-level access is required. GHENT runs entirely in your personal Google account.

## Configuration

The top-level label prefix defaults to `GHENT` (so labels are `GHENT/Mention`, `GHENT/Repos/my-repo`, etc.). To change it, set the `label_prefix` Script Property:

1. In the Apps Script editor, click the **gear icon** (Project Settings) in the left sidebar
2. Scroll down to **Script Properties**
3. Click **Add script property**
4. Set key to `label_prefix`, value to whatever you want (e.g., `GitHub`, `GH`, `Notifications`)
5. Click **Save**

Other settings can be changed in `src/config.js`:

```js
const CONFIG = {
  SHOULD_ARCHIVE: true,            // Set to false to label without archiving
  BATCH_SIZE: 50,                  // Threads per batch (50 is a safe default)
  TRIGGER_INTERVAL_MINUTES: 5,     // How often the trigger runs
};
```

After changing config, push to GAS:

```bash
npm run push
```

## Useful functions

Run these from the Apps Script editor:

| Function | What it does |
|---|---|
| `install` | Set up the automatic trigger (safe to run multiple times) |
| `uninstall` | Remove all GHENT triggers |
| `run` | Process your inbox right now |
| `resetLastRun` | Clear the timestamp so the next run processes all inbox threads |

## Development

```bash
npm test          # Run tests
npm run test:watch # Run tests in watch mode
npm run push       # Deploy to Google Apps Script
```

Tests use a VM-based loader (`test/gas-loader.mjs`) that evaluates the GAS source files with mocked globals (`GmailApp`, `PropertiesService`, etc.), so all the pure logic — header parsing, priority resolution, label assignment — is testable locally without deploying to Google.

## How it works

GitHub notification emails encode the notification reason in two places:

1. The `X-GitHub-Reason` header (e.g., `mention`, `review_requested`, `author`)
2. The CC field (e.g., `mention@noreply.github.com`, `author@noreply.github.com`)

GHENT checks the header first, falls back to the CC field. The repo and org are extracted from the email subject (e.g., `[Soffi-ai/soffi-main]`).

### Performance

GHENT only processes emails that are currently in your inbox (`in:inbox` query filter). Once a thread is archived, it won't be processed again unless new activity moves it back to inbox. Each run also scopes the search to emails received since the last run using Gmail's `after:` filter.

Processing happens in batches of 50 threads with a 5-minute safety valve to stay under the Google Apps Script 6-minute execution limit.

## Credits

Shamelessly adapted from and inspired by [OctoGAS](https://github.com/btoews/OctoGAS) by [@btoews](https://github.com/btoews).

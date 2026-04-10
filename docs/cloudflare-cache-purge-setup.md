# Cloudflare Cache Purge — Setup

The `deploy.sh` script now auto-purges Cloudflare's edge cache after each
successful Coolify deploy. Requires two env vars: `CF_ZONE_ID` and
`CF_API_TOKEN`.

If these aren't set, the script silently skips the purge (no error) so
local devs and partial deploys aren't blocked.

## Step 1 — Get the Zone ID

1. Sign in to <https://dash.cloudflare.com>
2. Click on **iku.gg** in the domain list
3. Scroll to the **API** panel on the right side of the Overview page
4. Copy the **Zone ID** (looks like `a1b2c3d4e5f6...` — 32 hex chars)

## Step 2 — Create a scoped API token

Don't use the Global API Key — it has full account access. A scoped
token only allows cache purge on one zone.

1. Go to <https://dash.cloudflare.com/profile/api-tokens>
2. Click **Create Token**
3. Scroll to **Custom token** → click **Get started**
4. Name: `iku.gg deploy cache purge`
5. **Permissions**:
   - Zone · **Cache Purge** · **Purge**
6. **Zone Resources**:
   - Include · Specific zone · **iku.gg**
7. (Leave Client IP Address Filtering and TTL blank)
8. Click **Continue to summary** → **Create Token**
9. **Copy the token immediately** — Cloudflare only shows it once

## Step 3 — Save both values to your shell

Add to `~/.bashrc` (or `~/.zshrc`, whichever shell you use):

```bash
export CF_ZONE_ID="<paste-zone-id-here>"
export CF_API_TOKEN="<paste-token-here>"
```

Then reload: `source ~/.bashrc`

## Step 4 — Verify

Run `./deploy.sh` with a no-op change. At the end of the output you
should see:

```
➜ Purging Cloudflare cache
✓ Cloudflare cache purged — edge nodes will pull fresh HTML
```

If you see `! CF_ZONE_ID or CF_API_TOKEN not set — skipping Cloudflare cache purge`,
the env vars aren't loaded. Re-source your rc file or open a fresh shell.

## What this fixes

The "This page couldn't load" error you saw on `/tag/ahegao` and
`/character/tifa-lockhart` during the audit was from Cloudflare serving
a stale HTML response that pointed to a JS chunk filename that no longer
existed on the server (the chunks had been renamed by the new build).

Without cache purge, edge nodes keep the stale HTML for up to 4h
(default Cloudflare cache TTL for HTML) after a deploy. With cache
purge, the HTML is invalidated instantly on every deploy and the next
visitor pulls the fresh version.

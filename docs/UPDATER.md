# Auto-update (Director desktop)

> Director starts → checks GitHub → if a newer **signed** build exists → shows an
> **Update** button → click → download → install → relaunch → updated.

Built on [Tauri's updater plugin](https://v2.tauri.app/plugin/updater/). Updates
are cryptographically signed; the app refuses any bundle whose signature doesn't
match the public key baked into it, so a release can never push a tampered or
unsigned build to users.

## How it works

1. On startup [`useUpdater`](../src/lib/updater/use-updater.ts) calls the plugin's
   `check()`, which fetches the manifest at the configured endpoint:
   `https://github.com/JessiP23/Director-desktop/releases/latest/download/latest.json`.
2. The manifest lists the latest version + the download URL + a minisign
   signature. If its version is newer than the running app, an update is
   "available".
3. The [`UpdateButton`](../src/components/layout/update-button.tsx) appears in the
   title bar (amber accent). **It is invisible when already up to date.**
4. On click: `downloadAndInstall()` downloads `Director.app.tar.gz`, verifies its
   signature against the pinned `pubkey`, installs it in place, then
   `relaunch()` restarts into the new version.

### Where everything lives

| Concern | Location |
| --- | --- |
| Endpoint + public key | `src-tauri/tauri.conf.json` → `plugins.updater` |
| Build emits `.tar.gz` + `.sig` | `src-tauri/tauri.conf.json` → `bundle.createUpdaterArtifacts: true` |
| Plugin registration | `src-tauri/src/lib.rs` |
| Permissions | `src-tauri/capabilities/default.json` (`updater:default`, `process:default`) |
| UI state machine | `src/lib/updater/use-updater.ts` |
| Button | `src/components/layout/update-button.tsx` |
| Release build + manifest + upload | `scripts/release-dmg.sh` |
| Pre-publish verification | `scripts/updater-verify.mjs` |

### Signing keys

- Private key: `~/.tauri/director-updater.key` (password-protected, **never commit**).
- Public key: pinned in `tauri.conf.json` (`plugins.updater.pubkey`).

The release build signs the artifact with the private key; the shipped app
verifies with the public key. They are a matched pair — if they ever diverge,
updates stop installing. The verifier below catches that before you publish.

## Cutting a release

```bash
# 1. Bump the version (must be > the installed version, semver).
#    Edit "version" in BOTH package.json and src-tauri/tauri.conf.json.

# 2. Provide the updater key password (the one set when the key was generated).
export TAURI_SIGNING_PRIVATE_KEY_PASSWORD='…'

# 3. Build + sign + generate latest.json + verify + upload to a GitHub release.
pnpm release:github
```

`release:github` runs `scripts/release-dmg.sh --upload`, which:

1. builds the DMG **and** the signed `Director.app.tar.gz` (+ `.sig`),
2. writes `latest.json` with the real signature and the release download URL,
3. **verifies the signature chain** (`updater-verify.mjs`) and aborts on any
   mismatch,
4. uploads `Director_<v>_aarch64.dmg`, `Director.app.tar.gz`, and `latest.json`
   to the `v<version>` GitHub release.

DMG = first install. `.app.tar.gz` = what existing installs auto-update from.

## Verifying before you publish (no upload)

```bash
# After a local build (pnpm release:dmg), prove the artifact will be accepted:
pnpm release:verify

# Also confirm the manifest's download URL is live on the release:
node scripts/updater-verify.mjs --check-url
```

This reproduces the **exact** ed25519/minisign verification the client performs.
A green run means: config has the artifact flag + key + endpoint, the `.tar.gz`
signature validates against the pinned public key, and `latest.json` carries a
matching signature and URL. If this passes, the in-app verification will pass.

## Automated end-to-end test (no GitHub push needed)

```bash
pnpm release:dmg   # build the signed artifacts first
pnpm release:e2e   # run the full client pipeline against them, locally
```

`scripts/updater-e2e.mjs` impersonates an older installed app and runs every
step the real updater runs — fetch manifest → version compare → download over
HTTP → **verify the minisign signature against the pinned public key** → unpack
and confirm a launchable `Director.app` — using the real signed bundle, served
from a throwaway local server. A green run means real users will update; the
only step it leaves out is Tauri's built-in bundle-swap + relaunch. It also
proves the negative case: pass `--current 0.1.0` and it reports "no update would
show", confirming the button stays hidden when already current.

## Manual runtime test (watch the button + relaunch with your own eyes)

The verifier proves the cryptography. To watch the whole **download → install →
relaunch** path against the real GitHub release, run a build that is one version
*behind* what's published, so the live `latest.json` looks like an update:

```bash
# Assumes v<current> is already published (dmg + tar.gz + latest.json) and
# verified. Here we pretend to be an older client.

# 1. Temporarily set the version LOWER than what's on the release, e.g. 0.0.9,
#    in src-tauri/tauri.conf.json (version field only).
# 2. Build and run that older app:
pnpm tauri build --bundles app --config src-tauri/tauri.macos.conf.json
open src-tauri/target/release/bundle/macos/Director.app

# 3. In the running app you should see the amber "Update" button appear within a
#    second or two. Click it. Expected: "Downloading n%" → "Installing" →
#    "Restarting", then the app relaunches as the published version.
# 4. Confirm the relaunched app no longer shows the Update button (it's current).
# 5. Revert the version in tauri.conf.json back to the real value.
```

If step 3 completes and the relaunched app is on the published version, the
auto-update works end to end for real users.

> Note: the very first `v0.1.0` release was uploaded with a placeholder
> `latest.json` (no signature, pointed at the `.dmg`). Re-run `pnpm release:github`
> on `v0.1.0` once to replace it with a correctly signed manifest + `.tar.gz`
> before relying on auto-update.

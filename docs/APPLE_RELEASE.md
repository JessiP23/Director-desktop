# Apple Release Guide

This app has two different Apple distribution paths:

- **Developer ID + notarized DMG**: best path for GitHub Releases and direct downloads.
- **Mac App Store / App Store Connect**: stricter review path. This app needs extra review work before that path, because the current macOS config uses private macOS APIs for vibrancy/window styling and relies on desktop-style OAuth.

## Apple Links

- Apple Developer account: https://developer.apple.com/account/
- Certificates, IDs & Profiles: https://developer.apple.com/account/resources/certificates/list
- Identifiers: https://developer.apple.com/account/resources/identifiers/list
- Profiles: https://developer.apple.com/account/resources/profiles/list
- App Store Connect: https://appstoreconnect.apple.com/
- App Store Connect API keys: https://appstoreconnect.apple.com/access/integrations/api
- Tauri macOS signing docs: https://v2.tauri.app/distribute/sign/macos/
- Tauri App Store docs: https://v2.tauri.app/distribute/app-store/

## Current App Identity

- Product name: `Director`
- Bundle identifier: `com.jessipavia.director-desktop`
- Version: `0.1.0`
- Distribution target today: notarized DMG for direct/GitHub downloads

Keep the bundle identifier stable once you create the Apple identifier. Changing it later creates a different app identity.

## One-Time Apple Setup

1. Enroll in the Apple Developer Program.
2. Open Certificates, IDs & Profiles: https://developer.apple.com/account/resources/certificates/list
3. Click the plus button.
4. Choose **Developer ID Application** for direct/GitHub distribution.
5. Create a certificate signing request from Keychain Access on your Mac:
   - Open Keychain Access.
   - Go to Certificate Assistant > Request a Certificate From a Certificate Authority.
   - Enter your Apple Developer email.
   - Select **Saved to disk**.
   - Upload that CSR file to Apple.
6. Download and install the `.cer` into your login keychain.
7. Confirm the identity is available:

```bash
security find-identity -v -p codesigning
```

You should see something like:

```text
Developer ID Application: Your Name (TEAMID)
```

For Mac App Store submission, also create/install:

- **Apple Distribution** certificate
- **Mac Installer Distribution** certificate

For GitHub/direct downloads, the required signing certificate is **Developer ID Application**. That is the certificate that prevents Gatekeeper from showing "Director is damaged" after the DMG is downloaded, once the DMG is also notarized.

## Notarization Credentials

Recommended: App Store Connect API key.

1. Open App Store Connect > Users and Access > Integrations: https://appstoreconnect.apple.com/access/integrations/api
2. Create an API key with Developer access.
3. Save the downloaded `AuthKey_XXXX.p8` file somewhere private. Apple only lets you download this once.
4. Export these environment variables:

```bash
export APPLE_SIGNING_IDENTITY="Developer ID Application: Your Name (TEAMID)"
export APPLE_API_ISSUER="issuer-id-from-app-store-connect"
export APPLE_API_KEY="key-id-from-app-store-connect"
export APPLE_API_KEY_PATH="/absolute/path/to/AuthKey_XXXX.p8"
```

Alternative Apple ID notarization:

```bash
export APPLE_SIGNING_IDENTITY="Developer ID Application: Your Name (TEAMID)"
export APPLE_ID="you@example.com"
export APPLE_PASSWORD="app-specific-password"
export APPLE_TEAM_ID="TEAMID"
```

## Check Readiness

```bash
pnpm release:apple:check
```

This checks for Xcode tools, Tauri, signing identity, notarization env vars, and GitHub CLI auth.

## Build Signed + Notarized DMG

```bash
pnpm release:apple
```

Expected output:

```text
src-tauri/target/release/bundle/dmg/Director_0.1.0_aarch64.dmg
```

Validate the downloaded DMG:

```bash
spctl -a -vvv -t open src-tauri/target/release/bundle/dmg/Director_0.1.0_aarch64.dmg
codesign -dv --verbose=4 src-tauri/target/release/bundle/macos/Director.app
```

## Upload to GitHub Releases

After `gh auth login`:

```bash
pnpm release:apple:github
```

This runs the Apple readiness check, builds the DMG with your signing/notarization environment, and uploads the DMG through GitHub CLI.

Or manually upload the DMG in GitHub:

1. Open the repo on GitHub.
2. Go to Releases.
3. Draft a new release.
4. Tag it, for example `v0.1.0`.
5. Upload the DMG from `src-tauri/target/release/bundle/dmg/`.

## Mac App Store Path

Before submitting to the Mac App Store, plan these changes:

- Remove `macOSPrivateApi: true` and the `macos-private-api` Tauri feature.
- Replace private vibrancy/window customization with App Store-safe styling.
- Confirm OAuth redirect behavior is acceptable for sandboxed Mac App Store distribution.
- Add App Sandbox entitlements if required by the chosen Tauri/App Store setup.
- Create the macOS app record in App Store Connect.
- Use Apple Distribution signing rather than Developer ID signing.

Until those are handled, use Developer ID notarized DMG for public distribution.

Prepared templates:

- `src-tauri/Info.appstore.plist`
- `src-tauri/Entitlements.appstore.example.plist`
- `src-tauri/tauri.appstore.conf.example.json`

To turn the templates into real App Store config:

1. Copy `src-tauri/Entitlements.appstore.example.plist` to `src-tauri/Entitlements.appstore.plist`.
2. Replace `TEAMID` with your Apple Team ID.
3. Create an App ID in Identifiers with Bundle ID `com.jessipavia.director-desktop`.
4. Create a **Mac App Store Connect** provisioning profile in Profiles.
5. Download it to `src-tauri/profiles/Director_Mac_App_Store.provisionprofile`.
6. Copy `src-tauri/tauri.appstore.conf.example.json` to `src-tauri/tauri.appstore.conf.json`.
7. Build the App Store `.app` bundle:

```bash
pnpm tauri build --no-bundle
pnpm tauri bundle --bundles app --target universal-apple-darwin --config src-tauri/tauri.appstore.conf.json
```

8. Build the App Store `.pkg`:

```bash
xcrun productbuild \
  --sign "3rd Party Mac Developer Installer: Your Name (TEAMID)" \
  --component "src-tauri/target/universal-apple-darwin/release/bundle/macos/Director.app" \
  /Applications \
  "Director.pkg"
```

9. Upload:

```bash
xcrun altool --upload-app \
  --type macos \
  --file "Director.pkg" \
  --apiKey "$APPLE_API_KEY" \
  --apiIssuer "$APPLE_API_ISSUER"
```

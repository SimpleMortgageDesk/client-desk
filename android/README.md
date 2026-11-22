# MySimpleDesk Android app

The app is a Trusted Web Activity: it opens https://mysimpledesk.co.uk full screen. When the website is updated, the app shows the update straight away, so the Android app itself rarely needs a new version.

## Building
GitHub builds it for you: Actions > "Android app" > Run workflow. It also builds whenever the `android` folder changes.
- Test app (installs on any Android phone): Releases > "MySimpleDesk test app (Android)" > MySimpleDesk-test.apk
- For Google Play: the build's Artifacts contain `app-release.aab` (signed when the signing secrets below are set).

## Signing secrets (GitHub > Settings > Secrets and variables > Actions)
- ANDROID_KEYSTORE_BASE64: the upload key file, encoded as text
- ANDROID_KEYSTORE_PASSWORD
- ANDROID_KEY_ALIAS  (upload)
- ANDROID_KEY_PASSWORD

## New version for Google Play
Raise `versionCode` by 1 in `android/version.properties` (Play refuses an upload with the same number), then run the build.

## Linking the website and the app
`/.well-known/assetlinks.json` on the website lists the signing fingerprints that are allowed. It needs the upload key's fingerprint and, after the first Play upload, the Play app signing fingerprint (Play Console > Setup > App signing). Without a match the app shows a thin address bar.

# Install the local Android test APK

This workflow produces a standalone Riah test APK with JavaScript and assets bundled inside. It does not need Expo Go or a running Metro server. It is not a Play Store production release.

## On your phone

1. Transfer the supplied `.apk` to the phone using USB or your preferred file-transfer method.
2. Open the APK from Files / Downloads and follow Android's installer prompts. If Android asks, allow the file-opening app to install this specific APK, then return that permission to its previous setting afterward.
3. Open Riah from the app drawer. Complete setup, then use Settings to enable local reminders if wanted.

The standalone app has separate local storage from Expo Go. Existing Expo Go records are not imported automatically. Do not uninstall an existing standalone Riah installation containing real records to resolve a signing conflict; there is no in-app backup/restore yet.

The local APK uses the generated Android development signing key. Keep the same signing identity for test updates. A production release needs a separate managed signing/release process. APKs and signing files are ignored by Git.

## Rebuild locally on Windows

With the Android SDK, NDK and JDK configured, run from the repository root:

```powershell
npm run check
node node_modules/expo/bin/cli prebuild --platform android --no-install
Set-Location android
$env:NODE_ENV = 'production'
.\gradlew.bat :app:assembleRelease '-PreactNativeArchitectures=arm64-v8a,x86_64' --max-workers=2 --console=plain
```

The generated APK is `android/app/build/outputs/apk/release/app-release.apk`. ARM64 covers the intended modern Android phone; x86_64 allows installing the same APK in the local emulator. Both architectures are packaged in one APK.

The `preview` EAS profile also explicitly requests APK output, but building locally does not upload this source to EAS or require Expo account access.

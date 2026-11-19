# Android app for the submission & project tracker

A thin Capacitor wrapper: the app opens the live page
(`https://jschang0512.github.io/Research-toolkit/submissions/`), so web updates reach the app without a new APK.
A new APK is only needed when the app name, icon or native plugins change.

Build (Windows), in a working folder outside OneDrive, e.g. `C:\Users\jscha\apps\tracker-android`:

1. Copy `package.json`, `capacitor.config.json`, `make-icons.js` there and create `www/index.html` (any offline notice).
2. `npm install`, then `npx cap add android` (first time) or `npx cap sync android`.
3. `node make-icons.js` (launcher icons and splash screens from the app icon).
4. `android/local.properties`: `sdk.dir=C:/Users/jscha/AppData/Local/Android/Sdk`.
5. Capacitor 8 needs Java 21+: `set JAVA_HOME=C:\Program Files\Android\Android Studio\jbr`, then `cd android && gradlew.bat assembleDebug`.
6. Bump `versionCode` / `versionName` in `android/app/build.gradle` for every release.
7. Copy `android/app/build/outputs/apk/debug/app-debug.apk` to `Research-toolkit/submissions/tracker.apk`.

Signed with this computer's Android debug key, the same as Splitbill, so updates install over the previous version.

# Android APK Build Guide (Capacitor)

This project is configured to package the web app as an Android APK using Capacitor.

## Prerequisites

- Android Studio installed
- Android SDK installed (Platform + Build-Tools)
- `ANDROID_HOME` set, or `android/local.properties` contains:

```
sdk.dir=C:\\Users\\<your-user>\\AppData\\Local\\Android\\Sdk
```

## Build Commands

1. Sync web assets and native project:

```
npm run android:sync
```

2. Build Debug APK:

```
npm run android:apk:debug
```

3. Output path:

```
android/app/build/outputs/apk/debug/app-debug.apk
```

## Release Signing (for distribution)

1. Create keystore:

```
keytool -genkey -v -keystore release.keystore -alias stockdashboard -keyalg RSA -keysize 2048 -validity 10000
```

2. Create `android/keystore.properties`:

```
storeFile=../release.keystore
storePassword=YOUR_STORE_PASSWORD
keyAlias=stockdashboard
keyPassword=YOUR_KEY_PASSWORD
```

3. Configure signing in `android/app/build.gradle` (release buildType).

4. Build release APK/AAB:

```
cd android
./gradlew assembleRelease
./gradlew bundleRelease
```

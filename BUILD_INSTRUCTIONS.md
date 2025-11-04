w# Android Build Instructions

## Option 1: Local Build (Current)
The build is currently running with:
```bash
npx expo run:android --variant release
```

**Output Location:**
- APK: `android/app/build/outputs/apk/release/app-release.apk`
- AAB: `android/app/build/outputs/bundle/release/app-release.aab`

**Time:** 5-15 minutes depending on your machine

---

## Option 2: EAS Build (Recommended for Production)

### Setup EAS:
```bash
npm install -g eas-cli
eas login
eas build:configure
```

### Build APK (for testing):
```bash
eas build --platform android --profile preview
```

### Build AAB (for Google Play Store):
```bash
eas build --platform android --profile production
```

**Advantages:**
- Builds in the cloud (no local setup needed)
- Automatic signing
- Optimized for production
- Can build iOS too

---

## Option 3: Development Build
For testing during development:
```bash
npx expo run:android
```

---

## After Build Completes

### Install APK on Device:
```bash
adb install android/app/build/outputs/apk/release/app-release.apk
```

### Or share the APK file directly with users

---

## Build Configuration

### Update app.json for production:
```json
{
  "expo": {
    "name": "Daily Recipe Generator",
    "slug": "daily-recipe-generator",
    "version": "1.0.0",
    "android": {
      "package": "com.yourcompany.recipeapp",
      "versionCode": 1,
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#061007"
      }
    }
  }
}
```

---

## Troubleshooting

### If build fails:
1. Check Java/Android SDK installation
2. Run: `npx expo doctor`
3. Clear cache: `npx expo start -c`
4. Rebuild: `cd android && ./gradlew clean`

### Memory issues:
Add to `android/gradle.properties`:
```
org.gradle.jvmargs=-Xmx4096m -XX:MaxPermSize=512m
```

# CLAUDE.md

## What is this project?

A custom **Expo Module** that wraps FFmpeg compiled from source for React Native. It provides GPU-accelerated video processing (watermark overlay + H.264 compression) for the Ruqaqa Finance mobile app.

This is a standalone test project. Once the module works, it will be moved to `finance_mobile_expo/modules/expo-ffmpeg/` as a local Expo module.

## Why custom instead of a community package?

The original `ffmpeg-kit-react-native` by arthenica was archived in June 2025, and its pre-built binaries were removed. Community forks exist but:
- None include GPU hardware encoders (VideoToolbox/MediaCodec) in their pre-built binaries
- Most have no reviewable GitHub repos or are maintained by single anonymous developers
- None are tested against current Expo SDK versions

By compiling FFmpeg ourselves, we get:
- GPU hardware encoding (4-8x faster than software)
- Minimal binary size (only what we need)
- Full control and auditability

## What the module does

Exposes 3 functions to JavaScript:

1. **`execute(command: string)`** — Run an FFmpeg command with progress callbacks
2. **`cancel()`** — Cancel the currently running FFmpeg command
3. **`getMediaInfo(path: string)`** — Get video metadata (duration, resolution, codec)

The typical use case:
```
input.mp4 + logo.png → FFmpeg single pass (overlay + H.264 GPU encode) → output.mp4
```

## Commands

```bash
npx create-expo-module@latest   # If scaffolding from scratch
pnpm install                    # Install deps
pnpm build                      # Build the module
pnpm test                       # Run tests
```

### Testing on device

This project includes a minimal example Expo app (`example/`) for testing the module on a real device.

#### Android (Samsung S23 Ultra, Android 36)
```bash
cd example
adb reverse tcp:8081 tcp:8081                    # Port forwarding for Metro
npx expo prebuild --clean --platform android     # Generate native project
cd android && ./gradlew assembleDebug            # Build APK
adb install -r app/build/outputs/apk/debug/app-debug.apk  # Install
adb shell am start -n com.ruqaqa.expoffmpegexample/.MainActivity  # Launch
adb logcat -d | grep "ExpoFFmpeg"                # Check logs
```

#### iOS (iPad Pro, iPadOS 26.2.1)
```bash
cd example
npx expo prebuild --clean --platform ios         # Generate native project
cd ios && pod install                             # Install CocoaPods
xcodebuild -workspace expoffmpegexample.xcworkspace \
  -scheme expoffmpegexample \
  -destination 'platform=iOS,id=00008103-0012584A1168801E' \
  -configuration Debug \
  -allowProvisioningUpdates \
  DEVELOPMENT_TEAM=6M7Y82N5C6 build              # Build for device

# Install on iPad
xcrun devicectl device install app \
  --device BD8F3F0D-F9B6-5248-A0AC-AEDE0B8BB1B3 \
  /Users/bassel/Library/Developer/Xcode/DerivedData/expoffmpegexample-axmdejztrnxwztcqsnfmnpwtrauh/Build/Products/Debug-iphoneos/expoffmpegexample.app

# Launch on iPad
xcrun devicectl device process launch \
  --device BD8F3F0D-F9B6-5248-A0AC-AEDE0B8BB1B3 \
  --terminate-existing com.ruqaqa.expoffmpegexample

# Push test files to iPad
xcrun devicectl device copy to \
  --device BD8F3F0D-F9B6-5248-A0AC-AEDE0B8BB1B3 \
  --domain-type appDataContainer \
  --domain-identifier com.ruqaqa.expoffmpegexample \
  --destination "Library/Caches/Bear.mp4" \
  --source /Users/bassel/Downloads/Bear.mp4

# Check Metro logs (JS console.log output appears here)
tail -30 /tmp/metro-ios.log
```

#### Metro bundler (serves JS to both platforms)
```bash
cd example
npx expo start --port 8081 --host lan            # Start Metro for LAN access
# Metro logs go to /tmp/metro-ios.log when piped
# Android uses adb reverse; iOS connects via LAN IP
```

#### Auto-test mode
Set `AUTO_NAVIGATE = true` in `example/app/_layout.tsx` to auto-run tests on launch.
Set back to `false` for normal UI navigation.

### iOS-specific caveats (iPadOS 26)

- **Library/Caches is READ-ONLY** — use `documentDirectory` for FFmpeg output paths on iOS
- **C open() with O_CREAT blocked** — Swift pre-creates output file, passes fd to C
- **DocumentPicker returns security-scoped URLs** — must use `copyToCacheDirectory: true`; `copyPickedFileToLocal` sanitizes filenames and has fallback chain (copyAsync → downloadAsync → original URI)
- **VideoToolbox hw decoding is NOT beneficial** — outputs frames to GPU memory requiring expensive `av_hwframe_transfer_data` copy back to CPU for the filter graph; unlike Android MediaCodec which outputs NV12 to CPU buffers directly. CPU (software) decoding + VideoToolbox encoding is the optimal iOS path.
- **No adb equivalent** — use `xcrun devicectl` for install/launch, `idevicesyslog` for logs
- **Metro logs** — JS console.log output shows in Metro terminal, NOT in device syslog
- **Device IDs**: iPad UDID=`00008103-0012584A1168801E`, CoreDevice=`BD8F3F0D-F9B6-5248-A0AC-AEDE0B8BB1B3`
- **Signing**: Team ID=`6M7Y82N5C6`, Identity=`Apple Development: edbavv@gmail.com`

### FFmpeg compilation

```bash
# Compile FFmpeg for Android (requires Android NDK)
./scripts/build-android.sh

# Compile FFmpeg for iOS (requires Xcode)
./scripts/build-ios.sh
```

## Architecture

```
expo-ffmpeg-module/
├── android/                  # Android native module (Kotlin)
│   ├── src/main/java/        # Kotlin bridge code (JNI → FFmpeg)
│   └── jniLibs/              # Pre-compiled FFmpeg .so files (arm64-v8a, armeabi-v7a)
├── ios/                      # iOS native module (Swift)
│   ├── ExpoFfmpegModule.swift    # Swift bridge code
│   └── Frameworks/           # Pre-compiled FFmpeg .xcframework
├── src/                      # TypeScript API exposed to JS
│   ├── index.ts              # Public API: execute(), cancel(), getMediaInfo()
│   └── types.ts              # TypeScript types
├── scripts/                  # FFmpeg cross-compilation scripts
│   ├── build-android.sh      # Android NDK cross-compile
│   ├── build-ios.sh          # iOS Xcode cross-compile
│   └── configure-flags.sh    # Shared FFmpeg configure flags
├── example/                  # Minimal Expo test app
│   ├── app/                  # Test screens
│   └── assets/               # Test video + watermark logo
├── BUILD_PLAN.md             # Detailed build plan
└── CLAUDE.md                 # This file
```

## FFmpeg build flags

These are the flags used when compiling FFmpeg from source:

```bash
# GPU hardware encoders
--enable-videotoolbox           # iOS GPU (H.264 hardware encode)
--enable-mediacodec --enable-jni # Android GPU (H.264 hardware encode)

# Software fallback
--enable-libx264 --enable-gpl   # CPU-based H.264 (when GPU unavailable)

# Only what we need
--enable-filter=overlay          # Watermark overlay
--enable-filter=scale            # Video scaling
--enable-demuxer=mov,mp4,matroska,image2  # Input formats
--enable-muxer=mp4              # Output format
--enable-decoder=h264,hevc,png,mjpeg      # Input codecs
--enable-encoder=h264_videotoolbox,h264_mediacodec,libx264,png  # Output codecs

# Disable everything else to minimize binary size
--disable-programs              # No ffmpeg/ffprobe CLI binaries
--disable-doc                   # No documentation
--disable-network               # No network protocols
--disable-avdevice              # No device I/O
```

## Conventions

- Use **pnpm**, not npm
- TypeScript strict mode
- The module follows the Expo Modules API pattern (not legacy native modules)
- Test on real Android device (not emulator) for accurate GPU encoder behavior
- Keep the binary as small as possible — disable everything not explicitly needed

## Key references

- [Expo Modules API docs](https://docs.expo.dev/modules/overview/)
- [FFmpeg configure options](https://ffmpeg.org/ffmpeg-all.html)
- [FFmpeg VideoToolbox encoding](https://trac.ffmpeg.org/wiki/HWAccelIntro)
- [Android NDK cross-compilation](https://developer.android.com/ndk/guides)
- Parent project: `../finance_mobile_expo/` — this module will be integrated there as `modules/expo-ffmpeg/`

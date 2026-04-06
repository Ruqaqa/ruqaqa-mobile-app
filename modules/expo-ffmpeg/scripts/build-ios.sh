#!/usr/bin/env bash
#
# build-ios.sh — Cross-compile libx264 + FFmpeg for iOS arm64 (physical devices)
#
# Creates .xcframework bundles in ios/Frameworks/ for:
#   - libavcodec, libavformat, libavutil, libavfilter, libswscale, libswresample
#   - libx264 (bundled into FFmpeg, not separate framework)
#
# Prerequisites:
#   - Xcode with iOS SDK (xcrun must work)
#   - Internet connection (downloads sources on first run)
#   - ~2GB disk space for build artifacts
#
# Usage:
#   ./scripts/build-ios.sh
#

set -euo pipefail

# ─── Configuration ────────────────────────────────────────────────────────────

FFMPEG_VERSION="7.1.1"
X264_REPO="https://code.videolan.org/videolan/x264.git"
X264_BRANCH="stable"

IOS_DEPLOYMENT_TARGET="15.1"
ARCH="arm64"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
BUILD_DIR="$PROJECT_DIR/build-ios"
SOURCE_DIR="$PROJECT_DIR/vendor"
X264_PREFIX="$BUILD_DIR/x264-install"
FFMPEG_PREFIX="$BUILD_DIR/ffmpeg-install"
FRAMEWORKS_DIR="$PROJECT_DIR/ios/Frameworks"

NUM_JOBS="$(sysctl -n hw.ncpu)"

# ─── Helpers ──────────────────────────────────────────────────────────────────

log() { printf "\033[1;34m==>\033[0m %s\n" "$1"; }
err() { printf "\033[1;31mERROR:\033[0m %s\n" "$1" >&2; exit 1; }

check_prereqs() {
  command -v xcrun >/dev/null 2>&1 || err "xcrun not found — install Xcode Command Line Tools"
  xcrun -sdk iphoneos --show-sdk-path >/dev/null 2>&1 || err "iOS SDK not found — install Xcode with iOS platform"

  local sdk_path
  sdk_path="$(xcrun -sdk iphoneos --show-sdk-path)"
  log "iOS SDK: $sdk_path"
  log "Deployment target: $IOS_DEPLOYMENT_TARGET"
  log "Architecture: $ARCH"
  log "Parallel jobs: $NUM_JOBS"
}

# iOS cross-compilation environment variables
setup_ios_env() {
  IOS_SDK_PATH="$(xcrun -sdk iphoneos --show-sdk-path)"

  # Use the actual clang binary path — xcrun multi-word commands break some configure scripts
  IOS_CC="$(xcrun -sdk iphoneos -f clang)"
  IOS_CXX="$(xcrun -sdk iphoneos -f clang++)"
  IOS_AR="$(xcrun -sdk iphoneos -f ar)"
  IOS_RANLIB="$(xcrun -sdk iphoneos -f ranlib)"
  IOS_STRIP="$(xcrun -sdk iphoneos -f strip)"
  IOS_NM="$(xcrun -sdk iphoneos -f nm)"

  export CC="$IOS_CC"
  export CXX="$IOS_CXX"
  export AR="$IOS_AR"
  export RANLIB="$IOS_RANLIB"
  export STRIP="$IOS_STRIP"
  export NM="$IOS_NM"

  export CFLAGS="-arch $ARCH -isysroot $IOS_SDK_PATH -miphoneos-version-min=$IOS_DEPLOYMENT_TARGET -O2"
  export LDFLAGS="-arch $ARCH -isysroot $IOS_SDK_PATH -miphoneos-version-min=$IOS_DEPLOYMENT_TARGET"
  export CXXFLAGS="$CFLAGS"
}

# ─── Download sources ─────────────────────────────────────────────────────────

download_sources() {
  mkdir -p "$SOURCE_DIR"

  # libx264
  if [ ! -d "$SOURCE_DIR/x264" ]; then
    log "Cloning libx264 (stable branch)..."
    git clone --depth 1 --branch "$X264_BRANCH" "$X264_REPO" "$SOURCE_DIR/x264"
  else
    log "libx264 source already exists, skipping download"
  fi

  # FFmpeg
  if [ ! -d "$SOURCE_DIR/ffmpeg-$FFMPEG_VERSION" ]; then
    log "Downloading FFmpeg $FFMPEG_VERSION..."
    local tarball="$SOURCE_DIR/ffmpeg-$FFMPEG_VERSION.tar.xz"
    if [ ! -f "$tarball" ]; then
      curl -L -o "$tarball" "https://ffmpeg.org/releases/ffmpeg-$FFMPEG_VERSION.tar.xz"
    fi
    log "Extracting FFmpeg..."
    tar xf "$tarball" -C "$SOURCE_DIR"
  else
    log "FFmpeg source already exists, skipping download"
  fi
}

# ─── Build libx264 ───────────────────────────────────────────────────────────

build_x264() {
  if [ -f "$X264_PREFIX/lib/libx264.a" ]; then
    log "libx264 already built, skipping"
    return 0
  fi

  log "Building libx264 for iOS $ARCH..."
  mkdir -p "$BUILD_DIR/x264-build"

  cd "$SOURCE_DIR/x264"

  # Clean previous build artifacts if any
  make distclean 2>/dev/null || true

  # x264's configure needs explicit cross-compile host and sysroot in both
  # C flags and assembler flags to ensure all .o files target iOS, not macOS.
  ./configure \
    --prefix="$X264_PREFIX" \
    --host=aarch64-apple-darwin \
    --enable-static \
    --disable-shared \
    --disable-cli \
    --enable-pic \
    --extra-cflags="-arch $ARCH -isysroot $IOS_SDK_PATH -miphoneos-version-min=$IOS_DEPLOYMENT_TARGET -O2 -target arm64-apple-ios${IOS_DEPLOYMENT_TARGET}" \
    --extra-asflags="-arch $ARCH -isysroot $IOS_SDK_PATH -miphoneos-version-min=$IOS_DEPLOYMENT_TARGET -target arm64-apple-ios${IOS_DEPLOYMENT_TARGET}" \
    --extra-ldflags="-arch $ARCH -isysroot $IOS_SDK_PATH -miphoneos-version-min=$IOS_DEPLOYMENT_TARGET -target arm64-apple-ios${IOS_DEPLOYMENT_TARGET}" \
    --cross-prefix="" \
    --sysroot="$IOS_SDK_PATH"

  make -j"$NUM_JOBS"
  make install

  log "libx264 installed to $X264_PREFIX"

  # Verify the library targets iOS, not macOS
  local platform_info
  platform_info="$(otool -l "$X264_PREFIX/lib/libx264.a" 2>/dev/null | grep -A2 "LC_BUILD_VERSION" | head -5 || true)"
  log "libx264 platform info: $platform_info"

  cd "$PROJECT_DIR"
}

# ─── Build FFmpeg ─────────────────────────────────────────────────────────────

build_ffmpeg() {
  if [ -f "$FFMPEG_PREFIX/lib/libavcodec.a" ]; then
    log "FFmpeg already built, skipping"
    return 0
  fi

  log "Building FFmpeg $FFMPEG_VERSION for iOS $ARCH..."

  # Source shared configure flags
  source "$SCRIPT_DIR/configure-flags.sh"

  # Point pkg-config at x264
  export PKG_CONFIG_PATH="$X264_PREFIX/lib/pkgconfig"

  cd "$SOURCE_DIR/ffmpeg-$FFMPEG_VERSION"

  # Clean previous build artifacts if any
  make distclean 2>/dev/null || true

  # Re-resolve paths (env was unset before calling this function)
  local sdk_path
  sdk_path="$(xcrun -sdk iphoneos --show-sdk-path)"
  local ios_cc ios_cxx ios_ar ios_ranlib ios_strip ios_nm
  ios_cc="$(xcrun -sdk iphoneos -f clang)"
  ios_cxx="$(xcrun -sdk iphoneos -f clang++)"
  ios_ar="$(xcrun -sdk iphoneos -f ar)"
  ios_ranlib="$(xcrun -sdk iphoneos -f ranlib)"
  ios_strip="$(xcrun -sdk iphoneos -f strip)"
  ios_nm="$(xcrun -sdk iphoneos -f nm)"

  # iOS-specific flags — override shared flags where needed
  local IOS_FLAGS=(
    --prefix="$FFMPEG_PREFIX"

    # Cross-compilation
    --arch="$ARCH"
    --target-os=darwin
    --cc="$ios_cc"
    --cxx="$ios_cxx"
    --ar="$ios_ar"
    --ranlib="$ios_ranlib"
    --strip="$ios_strip"
    --nm="$ios_nm"
    --enable-cross-compile

    # iOS-specific compiler flags
    --extra-cflags="-arch $ARCH -isysroot $sdk_path -miphoneos-version-min=$IOS_DEPLOYMENT_TARGET -I$X264_PREFIX/include -O2"
    --extra-ldflags="-arch $ARCH -isysroot $sdk_path -miphoneos-version-min=$IOS_DEPLOYMENT_TARGET -L$X264_PREFIX/lib"

    # iOS GPU hardware encoder
    --enable-videotoolbox
    --enable-encoder=h264_videotoolbox

    # Static libraries for iOS (override shared config)
    --enable-static
    --disable-shared

    # iOS doesn't need these
    --disable-debug
    --enable-pic
    --enable-neon
  )

  # Combine shared flags + iOS-specific flags.
  # iOS-specific flags come AFTER shared flags so they can override.
  ./configure "${COMMON_FLAGS[@]}" "${IOS_FLAGS[@]}"

  make -j"$NUM_JOBS"
  make install

  log "FFmpeg installed to $FFMPEG_PREFIX"
  cd "$PROJECT_DIR"
}

# ─── Create .xcframework bundles ─────────────────────────────────────────────

create_xcframeworks() {
  log "Creating .xcframework bundles..."
  mkdir -p "$FRAMEWORKS_DIR"

  # FFmpeg libraries to package
  local FFMPEG_LIBS=(libavcodec libavformat libavutil libavfilter libswscale libswresample)

  for lib in "${FFMPEG_LIBS[@]}"; do
    local lib_file="$FFMPEG_PREFIX/lib/${lib}.a"
    local header_dir="$FFMPEG_PREFIX/include"

    if [ ! -f "$lib_file" ]; then
      log "Warning: $lib_file not found, skipping"
      continue
    fi

    local xcfw_path="$FRAMEWORKS_DIR/${lib}.xcframework"

    # Remove existing xcframework if any
    rm -rf "$xcfw_path"

    # Create a temporary framework structure for xcodebuild
    local tmp_fw="$BUILD_DIR/tmp-frameworks/${lib}.framework"
    rm -rf "$tmp_fw"
    mkdir -p "$tmp_fw/Headers"

    # Copy the static library as the framework binary
    cp "$lib_file" "$tmp_fw/${lib}"

    # Copy headers — FFmpeg installs to include/libavcodec/, include/libavutil/, etc.
    if [ -d "$header_dir/$lib" ]; then
      cp -R "$header_dir/$lib/"* "$tmp_fw/Headers/"
    fi

    # Create a minimal Info.plist
    cat > "$tmp_fw/Info.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleName</key>
  <string>${lib}</string>
  <key>CFBundleIdentifier</key>
  <string>com.ruqaqa.ffmpeg.${lib}</string>
  <key>CFBundleVersion</key>
  <string>${FFMPEG_VERSION}</string>
  <key>CFBundlePackageType</key>
  <string>FMWK</string>
  <key>MinimumOSVersion</key>
  <string>${IOS_DEPLOYMENT_TARGET}</string>
  <key>CFBundleSupportedPlatforms</key>
  <array>
    <string>iPhoneOS</string>
  </array>
</dict>
</plist>
PLIST

    # Create .xcframework
    xcodebuild -create-xcframework \
      -framework "$tmp_fw" \
      -output "$xcfw_path"

    log "Created $xcfw_path"
  done

  # Also create xcframework for libx264 (needed at link time)
  local x264_xcfw="$FRAMEWORKS_DIR/libx264.xcframework"
  rm -rf "$x264_xcfw"

  local tmp_x264_fw="$BUILD_DIR/tmp-frameworks/libx264.framework"
  rm -rf "$tmp_x264_fw"
  mkdir -p "$tmp_x264_fw/Headers"
  cp "$X264_PREFIX/lib/libx264.a" "$tmp_x264_fw/libx264"
  if [ -d "$X264_PREFIX/include" ]; then
    cp -R "$X264_PREFIX/include/"* "$tmp_x264_fw/Headers/"
  fi
  cat > "$tmp_x264_fw/Info.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleName</key>
  <string>libx264</string>
  <key>CFBundleIdentifier</key>
  <string>com.ruqaqa.ffmpeg.libx264</string>
  <key>CFBundleVersion</key>
  <string>1.0</string>
  <key>CFBundlePackageType</key>
  <string>FMWK</string>
  <key>MinimumOSVersion</key>
  <string>${IOS_DEPLOYMENT_TARGET}</string>
  <key>CFBundleSupportedPlatforms</key>
  <array>
    <string>iPhoneOS</string>
  </array>
</dict>
</plist>
PLIST

  xcodebuild -create-xcframework \
    -framework "$tmp_x264_fw" \
    -output "$x264_xcfw"

  log "Created $x264_xcfw"

  # Clean up temp frameworks
  rm -rf "$BUILD_DIR/tmp-frameworks"
}

# ─── Verify output ───────────────────────────────────────────────────────────

verify_output() {
  log "Verifying output..."

  local all_ok=true

  for fw in "$FRAMEWORKS_DIR"/*.xcframework; do
    local name
    name="$(basename "$fw")"
    if [ -d "$fw" ]; then
      printf "  %-30s ✓\n" "$name"
    else
      printf "  %-30s ✗ MISSING\n" "$name"
      all_ok=false
    fi
  done

  # Check architecture of one library
  local avcodec_lib
  avcodec_lib="$(find "$FRAMEWORKS_DIR/libavcodec.xcframework" -name "libavcodec" -not -name "*.plist" | head -1)"
  if [ -n "$avcodec_lib" ]; then
    local arch_info
    arch_info="$(lipo -info "$avcodec_lib" 2>/dev/null || true)"
    log "libavcodec architecture: $arch_info"
  fi

  if $all_ok; then
    log "All .xcframework bundles created successfully in $FRAMEWORKS_DIR/"
  else
    err "Some frameworks are missing — check build output above"
  fi
}

# ─── Main ─────────────────────────────────────────────────────────────────────

main() {
  log "=== iOS FFmpeg Build Script ==="
  log "FFmpeg version: $FFMPEG_VERSION"
  log ""

  check_prereqs
  download_sources

  setup_ios_env
  build_x264

  # Reset env for FFmpeg (it uses its own --cc flags)
  unset CC CXX AR RANLIB STRIP NM CFLAGS CXXFLAGS LDFLAGS

  build_ffmpeg
  create_xcframeworks
  verify_output

  log ""
  log "=== iOS build complete ==="
  log "Frameworks are in: $FRAMEWORKS_DIR/"
}

main "$@"

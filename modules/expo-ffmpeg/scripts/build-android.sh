#!/usr/bin/env bash
#
# Cross-compile FFmpeg (+ libx264 dependency) for Android.
# Produces shared libraries (.so) for arm64-v8a and armeabi-v7a.
#
# Prerequisites:
#   - Android NDK installed (set ANDROID_NDK_HOME or auto-detected)
#   - git, make, nasm/yasm on PATH
#
# Usage:
#   ./scripts/build-android.sh
#
set -euo pipefail

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
BUILD_ROOT="$PROJECT_DIR/build-android"
FFMPEG_VERSION="7.1.1"
API_LEVEL=24
NUM_JOBS=$(sysctl -n hw.ncpu 2>/dev/null || nproc)

# Source shared configure flags
source "$SCRIPT_DIR/configure-flags.sh"

# ---------------------------------------------------------------------------
# Detect Android NDK
# ---------------------------------------------------------------------------
if [[ -z "${ANDROID_NDK_HOME:-}" ]]; then
  # Auto-detect: pick the latest NDK version installed
  NDK_BASE="$HOME/Library/Android/sdk/ndk"
  if [[ -d "$NDK_BASE" ]]; then
    ANDROID_NDK_HOME="$NDK_BASE/$(ls "$NDK_BASE" | sort -V | tail -1)"
  fi
fi

if [[ ! -d "${ANDROID_NDK_HOME:-}" ]]; then
  echo "ERROR: Android NDK not found. Set ANDROID_NDK_HOME or install via Android SDK Manager."
  exit 1
fi

TOOLCHAIN="$ANDROID_NDK_HOME/toolchains/llvm/prebuilt/darwin-x86_64"
if [[ ! -d "$TOOLCHAIN" ]]; then
  echo "ERROR: NDK toolchain not found at $TOOLCHAIN"
  exit 1
fi

echo "Using NDK: $ANDROID_NDK_HOME"
echo "Toolchain: $TOOLCHAIN"
echo "Build jobs: $NUM_JOBS"

# ---------------------------------------------------------------------------
# Architecture definitions (bash 3.x compatible — no associative arrays)
# ---------------------------------------------------------------------------
ARCHS="arm64-v8a armeabi-v7a"

arch_triple() {
  case "$1" in
    arm64-v8a)   echo "aarch64-linux-android" ;;
    armeabi-v7a) echo "arm-linux-androideabi" ;;
  esac
}

arch_cc_prefix() {
  case "$1" in
    arm64-v8a)   echo "aarch64-linux-android${API_LEVEL}" ;;
    armeabi-v7a) echo "armv7a-linux-androideabi${API_LEVEL}" ;;
  esac
}

arch_cpu() {
  case "$1" in
    arm64-v8a)   echo "armv8-a" ;;
    armeabi-v7a) echo "armv7-a" ;;
  esac
}

arch_ffmpeg() {
  case "$1" in
    arm64-v8a)   echo "aarch64" ;;
    armeabi-v7a) echo "arm" ;;
  esac
}

# 16KB page alignment for Android 15+ compatibility
PAGE_SIZE_FLAG="-Wl,-z,max-page-size=16384"

# ---------------------------------------------------------------------------
# Helper: download / extract FFmpeg source
# ---------------------------------------------------------------------------
download_ffmpeg() {
  local src_dir="$BUILD_ROOT/ffmpeg-$FFMPEG_VERSION"
  if [[ -d "$src_dir" ]]; then
    echo "FFmpeg source already exists at $src_dir, skipping download."
    return
  fi
  echo "Downloading FFmpeg $FFMPEG_VERSION..."
  mkdir -p "$BUILD_ROOT"
  local tarball="$BUILD_ROOT/ffmpeg-${FFMPEG_VERSION}.tar.xz"
  if [[ ! -f "$tarball" ]]; then
    curl -L "https://ffmpeg.org/releases/ffmpeg-${FFMPEG_VERSION}.tar.xz" -o "$tarball"
  fi
  echo "Extracting FFmpeg..."
  tar xf "$tarball" -C "$BUILD_ROOT"
}

# ---------------------------------------------------------------------------
# Helper: clone / update libx264 source
# ---------------------------------------------------------------------------
download_x264() {
  local src_dir="$BUILD_ROOT/x264"
  if [[ -d "$src_dir" ]]; then
    echo "x264 source already exists at $src_dir, skipping clone."
    return
  fi
  echo "Cloning x264..."
  mkdir -p "$BUILD_ROOT"
  git clone --depth 1 https://code.videolan.org/videolan/x264.git "$src_dir"
}

# ---------------------------------------------------------------------------
# Build libx264 for one architecture
# ---------------------------------------------------------------------------
build_x264_arch() {
  local arch="$1"
  local triple
  triple="$(arch_triple "$arch")"
  local cc_prefix
  cc_prefix="$(arch_cc_prefix "$arch")"
  local prefix="$BUILD_ROOT/x264-output/$arch"

  if [[ -f "$prefix/lib/libx264.a" ]]; then
    echo "x264 for $arch already built, skipping."
    return
  fi

  echo "=========================================="
  echo "Building x264 for $arch"
  echo "=========================================="

  local build_dir="$BUILD_ROOT/x264-build-$arch"
  rm -rf "$build_dir"
  cp -a "$BUILD_ROOT/x264" "$build_dir"
  cd "$build_dir"

  local cc="$TOOLCHAIN/bin/${cc_prefix}-clang"
  local tool_prefix="$TOOLCHAIN/bin/llvm-"

  # x264 uses CC env var and --cross-prefix for tools (not --cc)
  CC="$cc" \
  ./configure \
    --prefix="$prefix" \
    --host="$triple" \
    --cross-prefix="${tool_prefix}" \
    --sysroot="$TOOLCHAIN/sysroot" \
    --enable-static \
    --enable-pic \
    --disable-cli \
    --disable-asm \
    --extra-cflags="-fPIC" \
    --extra-ldflags="$PAGE_SIZE_FLAG"

  make -j"$NUM_JOBS"
  make install

  echo "x264 for $arch installed to $prefix"
  cd "$PROJECT_DIR"
}

# ---------------------------------------------------------------------------
# Build FFmpeg for one architecture
# ---------------------------------------------------------------------------
build_ffmpeg_arch() {
  local arch="$1"
  local triple
  triple="$(arch_triple "$arch")"
  local cc_prefix
  cc_prefix="$(arch_cc_prefix "$arch")"
  local ffmpeg_arch
  ffmpeg_arch="$(arch_ffmpeg "$arch")"
  local cpu
  cpu="$(arch_cpu "$arch")"
  local x264_prefix="$BUILD_ROOT/x264-output/$arch"
  local prefix="$BUILD_ROOT/ffmpeg-output/$arch"

  if [[ -f "$prefix/lib/libavcodec.so" ]]; then
    echo "FFmpeg for $arch already built, skipping."
    return
  fi

  echo "=========================================="
  echo "Building FFmpeg for $arch"
  echo "=========================================="

  local build_dir="$BUILD_ROOT/ffmpeg-build-$arch"
  rm -rf "$build_dir"
  cp -a "$BUILD_ROOT/ffmpeg-$FFMPEG_VERSION" "$build_dir"
  cd "$build_dir"

  local cc="$TOOLCHAIN/bin/${cc_prefix}-clang"
  local cxx="$TOOLCHAIN/bin/${cc_prefix}-clang++"
  local cross_prefix="$TOOLCHAIN/bin/${triple}-"

  # Platform-specific flags for Android
  local platform_flags=(
    --target-os=android
    --arch="$ffmpeg_arch"
    --cpu="$cpu"
    --cc="$cc"
    --cxx="$cxx"
    --cross-prefix="$cross_prefix"
    --sysroot="$TOOLCHAIN/sysroot"
    --prefix="$prefix"

    # Android GPU encoder
    --enable-mediacodec
    --enable-jni
    --enable-encoder=h264_mediacodec
    --enable-decoder=h264_mediacodec

    # Link against our cross-compiled x264
    --extra-cflags="-I${x264_prefix}/include -fPIC"
    --extra-ldflags="-L${x264_prefix}/lib ${PAGE_SIZE_FLAG}"

    # Android-specific
    --enable-cross-compile
    --enable-pic

    # Use llvm tools
    --ar="${TOOLCHAIN}/bin/llvm-ar"
    --ranlib="${TOOLCHAIN}/bin/llvm-ranlib"
    --strip="${TOOLCHAIN}/bin/llvm-strip"
    --nm="${TOOLCHAIN}/bin/llvm-nm"

    # pkg-config for x264 detection
    --pkg-config="$(command -v pkg-config || echo pkg-config)"
  )

  # arm-specific: disable asm for armv7 to avoid build issues with NEON inline asm
  if [[ "$arch" == "armeabi-v7a" ]]; then
    platform_flags+=(--disable-asm)
  fi

  export PKG_CONFIG_PATH="$x264_prefix/lib/pkgconfig"

  ./configure "${COMMON_FLAGS[@]}" "${platform_flags[@]}"

  make -j"$NUM_JOBS"
  make install

  echo "FFmpeg for $arch installed to $prefix"
  cd "$PROJECT_DIR"
}

# ---------------------------------------------------------------------------
# Collect .so files into android/jniLibs/
# ---------------------------------------------------------------------------
collect_libraries() {
  echo "=========================================="
  echo "Collecting shared libraries"
  echo "=========================================="

  for arch in $ARCHS; do
    local src="$BUILD_ROOT/ffmpeg-output/$arch/lib"
    local dst="$PROJECT_DIR/android/jniLibs/$arch"

    mkdir -p "$dst"
    # Remove old libraries
    rm -f "$dst"/*.so

    # Copy all FFmpeg shared libraries (follow symlinks to get real files)
    for lib in libavcodec libavformat libavutil libavfilter libswscale libswresample; do
      local so_file
      # Find the versioned .so file (e.g., libavcodec.so.61)
      so_file=$(find "$src" -maxdepth 1 -name "${lib}.so*" -not -name "*.so.*.*.100" -type f 2>/dev/null | head -1)
      if [[ -n "$so_file" ]]; then
        # Copy the actual file as libX.so (unversioned) for Android
        cp -L "$so_file" "$dst/${lib}.so"
        echo "  Copied ${lib}.so -> $dst/"
      else
        echo "  WARNING: ${lib}.so not found in $src"
      fi
    done
  done
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
main() {
  echo "============================================================"
  echo "FFmpeg Android Build Script"
  echo "============================================================"
  echo ""

  mkdir -p "$BUILD_ROOT"

  # Step 1: Download sources
  download_ffmpeg
  download_x264

  # Step 2: Build libx264 for each architecture
  for arch in $ARCHS; do
    build_x264_arch "$arch"
  done

  # Step 3: Build FFmpeg for each architecture
  for arch in $ARCHS; do
    build_ffmpeg_arch "$arch"
  done

  # Step 4: Collect output libraries
  collect_libraries

  echo ""
  echo "============================================================"
  echo "Build complete!"
  echo "============================================================"
  echo ""
  echo "Libraries are in:"
  for arch in $ARCHS; do
    echo "  android/jniLibs/$arch/"
    ls -lh "$PROJECT_DIR/android/jniLibs/$arch/"*.so 2>/dev/null || echo "    (no .so files found)"
  done
}

main "$@"

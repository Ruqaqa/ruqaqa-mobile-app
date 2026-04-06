#!/usr/bin/env bash
# Shared FFmpeg configure flags for both Android and iOS builds.
# Source this file from build-android.sh and build-ios.sh.
#
# Usage:
#   source "$(dirname "$0")/configure-flags.sh"
#   ./configure "${COMMON_FLAGS[@]}" "${PLATFORM_FLAGS[@]}"

# Start from nothing, then selectively enable only what we need.
COMMON_FLAGS=(
  --disable-everything

  # Formats
  --enable-demuxer=mov,mp4,matroska,image2
  --enable-muxer=mp4,image2

  # Decoders (input codecs)
  --enable-decoder=h264,hevc,png,mjpeg

  # Encoders (software fallback — platform GPU encoders added per-platform)
  --enable-encoder=libx264,png,mjpeg

  # Filters
  --enable-filter=overlay,scale

  # Protocols
  --enable-protocol=file

  # libx264 (software H.264 encoder)
  --enable-libx264
  --enable-gpl

  # Parsers needed for demuxing
  --enable-parser=h264,hevc,png,mjpeg

  # BSF needed for MP4 muxing
  --enable-bsf=h264_mp4toannexb,hevc_mp4toannexb,extract_extradata,h264_metadata

  # Disable things we don't need
  --disable-programs
  --disable-doc
  --disable-network
  --disable-avdevice

  # Build shared libraries
  --enable-shared
  --disable-static

  # Optimizations
  --enable-small
)

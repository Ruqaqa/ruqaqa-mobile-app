require 'json'

package = JSON.parse(File.read(File.join(__dir__, '..', 'package.json')))

Pod::Spec.new do |s|
  s.name           = 'ExpoFfmpeg'
  s.version        = package['version']
  s.summary        = package['description']
  s.description    = package['description']
  s.license        = package['license']
  s.author         = package['author']
  s.homepage       = package['homepage']
  s.platforms      = { :ios => '15.1' }
  s.swift_version  = '5.9'
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  # Source files: Swift module + C wrapper
  s.source_files = [
    '*.swift',
    'FFmpegWrapper.c',
    'FFmpegWrapper.h',
    'ExpoFfmpegC/include/**/*.{h,modulemap}'
  ]

  # Module map for exposing C functions to Swift
  s.preserve_paths = [
    'ExpoFfmpegC/include/module.modulemap',
    'FFmpegHeaders/**/*',
    'Frameworks/**/*'
  ]

  # Pre-compiled FFmpeg static libraries as xcframeworks
  s.vendored_frameworks = [
    'Frameworks/libavcodec.xcframework',
    'Frameworks/libavformat.xcframework',
    'Frameworks/libavutil.xcframework',
    'Frameworks/libavfilter.xcframework',
    'Frameworks/libswscale.xcframework',
    'Frameworks/libswresample.xcframework',
    'Frameworks/libx264.xcframework'
  ]

  # System frameworks required by FFmpeg (VideoToolbox for GPU encoding)
  s.frameworks = [
    'VideoToolbox',
    'CoreMedia',
    'CoreVideo',
    'Security',
    'AudioToolbox',
    'CoreFoundation',
    'CoreServices'
  ]

  s.libraries = ['z', 'bz2', 'iconv']

  # Create symlink-based header directory for FFmpeg's #include <libavcodec/...> style
  s.prepare_command = <<-CMD
    mkdir -p FFmpegHeaders
    for lib in libavcodec libavformat libavutil libavfilter libswscale libswresample; do
      rm -f "FFmpegHeaders/${lib}"
      ln -sfn "../Frameworks/${lib}.xcframework/ios-arm64/${lib}.framework/Headers" "FFmpegHeaders/${lib}"
    done
  CMD

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    # FFmpegHeaders/ contains symlinks: libavcodec/ -> ...Headers, libavutil/ -> ...Headers, etc.
    # This lets #include <libavcodec/avcodec.h> resolve correctly.
    'HEADER_SEARCH_PATHS' => '"$(PODS_TARGET_SRCROOT)/FFmpegHeaders" "$(PODS_TARGET_SRCROOT)/ExpoFfmpegC/include" "$(PODS_TARGET_SRCROOT)"',
    # Swift import path for the ExpoFfmpegC module
    'SWIFT_INCLUDE_PATHS' => '"$(PODS_TARGET_SRCROOT)/ExpoFfmpegC/include"',
    # Ensure C files compile with correct settings
    'GCC_C_LANGUAGE_STANDARD' => 'c11'
  }
end

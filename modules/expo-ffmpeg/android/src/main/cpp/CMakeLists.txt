cmake_minimum_required(VERSION 3.22.1)
project(ffmpeg-jni C)

# Resolve the android/ module root relative to this CMakeLists.txt
# This file is at android/src/main/cpp/CMakeLists.txt
# android/ root is 3 levels up
get_filename_component(ANDROID_MODULE_DIR "${CMAKE_SOURCE_DIR}/../../.." ABSOLUTE)

# Build the JNI bridge as a shared library
add_library(ffmpeg-jni SHARED ffmpeg_jni.c)

# FFmpeg headers — copied into the module so they ship with the source
set(FFMPEG_INCLUDE_DIR "${ANDROID_MODULE_DIR}/ffmpeg-headers")

target_include_directories(ffmpeg-jni PRIVATE ${FFMPEG_INCLUDE_DIR})

# Import pre-built FFmpeg shared libraries from jniLibs
# CMake's ANDROID_ABI variable matches our jniLibs directory names (arm64-v8a, armeabi-v7a)
set(JNILIBS_DIR "${ANDROID_MODULE_DIR}/jniLibs/${ANDROID_ABI}")

# Define imported library targets for each FFmpeg library
foreach(LIB avutil swresample avcodec avformat avfilter swscale)
    add_library(${LIB} SHARED IMPORTED)
    set_target_properties(${LIB} PROPERTIES
        IMPORTED_LOCATION "${JNILIBS_DIR}/lib${LIB}.so"
    )
endforeach()

# Link order matters: higher-level libs first, then their dependencies
target_link_libraries(ffmpeg-jni
    avfilter
    avformat
    avcodec
    swresample
    swscale
    avutil
    android
    mediandk
    log
    m
    z
)

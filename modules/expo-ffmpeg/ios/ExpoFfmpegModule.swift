import ExpoModulesCore
import ExpoFfmpegC

public class ExpoFfmpegModule: Module {
  private let lock = NSLock()
  private var _isExecuting = false
  private var isExecuting: Bool {
    get { lock.lock(); defer { lock.unlock() }; return _isExecuting }
    set { lock.lock(); defer { lock.unlock() }; _isExecuting = newValue }
  }
  private let executionQueue = DispatchQueue(label: "expo.modules.ffmpeg.execution", qos: .userInitiated)
  private var progressObserver: NSObjectProtocol?

  // MARK: - iOS Sandbox Workaround
  //
  // iOS sandbox blocks C-level open() with O_CREAT even within the app container.
  // Foundation APIs (Data.write, FileManager) CAN write files.
  //
  // Strategy:
  // 1. Rewrite the output path in the FFmpeg command to use NSTemporaryDirectory
  //    (this fixes image2 muxer which handles its own I/O internally)
  // 2. Open the tmp output file via Foundation and pass the fd to C
  //    (this fixes mp4/mov muxers which use avio_open -> open())
  // 3. After FFmpeg finishes, move the output from tmp to the original location
  //    using Foundation's moveItem (which works in the sandbox)

  private struct OutputRewrite {
    let modifiedCommand: String
    let originalPath: String
    let tmpPath: String
    let fd: Int32  // pre-opened fd for non-image2 outputs, or -1
  }

  private static func prepareOutput(command: String) -> OutputRewrite? {
    let tokens = tokenizeCommand(command)
    guard tokens.count >= 2 else { return nil }

    let lastToken = tokens[tokens.count - 1]
    guard !lastToken.hasPrefix("-") else { return nil }

    // Resolve symlinks: JS passes /var/mobile/... but iOS canonical path is /private/var/mobile/...
    let resolvedPath = (lastToken as NSString).resolvingSymlinksInPath
    let origUrl = URL(fileURLWithPath: resolvedPath)
    let fm = FileManager.default

    // Check if this is an image2 output (AVFMT_NOFILE — handles its own I/O)
    var isImage2 = false
    for (i, t) in tokens.enumerated() {
      if t == "-f" && i + 1 < tokens.count && tokens[i + 1] == "image2" {
        isImage2 = true
        break
      }
    }

    // For image2: rewrite path to tmp (image2 muxer handles its own I/O)
    // For mp4/other: create file via Foundation, get fd (C open() is blocked by sandbox)
    //
    // We ALWAYS use the workaround on iOS because C-level open() with O_CREAT
    // is blocked by the sandbox even though Foundation APIs work fine.

    if isImage2 {
      // Rewrite to tmp directory for image2 muxer
      let tmpDir = NSTemporaryDirectory()
      let tmpUrl = URL(fileURLWithPath: tmpDir).appendingPathComponent(origUrl.lastPathComponent)
      let tmpPath = tmpUrl.path
      try? fm.removeItem(at: tmpUrl)

      var modified = command
      let quotedOrig = "\"\(lastToken)\""
      let quotedTmp = "\"\(tmpPath)\""
      if modified.contains(quotedOrig) {
        modified = modified.replacingOccurrences(of: quotedOrig, with: quotedTmp)
      } else if let range = modified.range(of: lastToken, options: .backwards) {
        modified = modified.replacingCharacters(in: range, with: tmpPath)
      }

      return OutputRewrite(modifiedCommand: modified, originalPath: resolvedPath, tmpPath: tmpPath, fd: -1)
    } else {
      // For mp4/other: create file at original path via Foundation, get fd
      let dir = origUrl.deletingLastPathComponent()
      try? fm.createDirectory(at: dir, withIntermediateDirectories: true, attributes: nil)
      try? fm.removeItem(at: origUrl)

      // Create the file via Foundation (which works in iOS sandbox)
      guard fm.createFile(atPath: resolvedPath, contents: nil, attributes: nil) else {
        // Fallback: try tmp directory
        let tmpDir = NSTemporaryDirectory()
        let tmpUrl = URL(fileURLWithPath: tmpDir).appendingPathComponent(origUrl.lastPathComponent)
        try? fm.removeItem(at: tmpUrl)
        fm.createFile(atPath: tmpUrl.path, contents: nil, attributes: nil)

        if let handle = FileHandle(forWritingAtPath: tmpUrl.path) {
          handle.truncateFile(atOffset: 0)
          let fd = Int32(dup(handle.fileDescriptor))
          handle.closeFile()
          return OutputRewrite(modifiedCommand: command, originalPath: lastToken, tmpPath: tmpUrl.path, fd: fd)
        }
        return nil
      }

      guard let handle = FileHandle(forWritingAtPath: resolvedPath) else { return nil }
      handle.truncateFile(atOffset: 0)
      let fd = Int32(dup(handle.fileDescriptor))
      handle.closeFile()

      // Rewrite command to use resolved path, fd is for that path
      var modified = command
      let quotedOrig = "\"\(lastToken)\""
      let quotedResolved = "\"\(resolvedPath)\""
      if modified.contains(quotedOrig) {
        modified = modified.replacingOccurrences(of: quotedOrig, with: quotedResolved)
      }
      return OutputRewrite(modifiedCommand: modified, originalPath: lastToken, tmpPath: resolvedPath, fd: fd)
    }
  }

  private static func moveOutput(from tmpPath: String, to originalPath: String) {
    // Resolve both paths to compare canonically (avoid deleting same file via symlink)
    let resolvedTmp = (tmpPath as NSString).resolvingSymlinksInPath
    let resolvedOrig = (originalPath as NSString).resolvingSymlinksInPath
    guard resolvedTmp != resolvedOrig else { return } // same file, no move needed

    let fm = FileManager.default
    guard fm.fileExists(atPath: tmpPath) else { return }

    let destDir = URL(fileURLWithPath: originalPath).deletingLastPathComponent()
    try? fm.createDirectory(at: destDir, withIntermediateDirectories: true, attributes: nil)
    try? fm.removeItem(atPath: originalPath)

    do {
      try fm.copyItem(atPath: tmpPath, toPath: originalPath)
      try? fm.removeItem(atPath: tmpPath)
    } catch {
      try? fm.moveItem(atPath: tmpPath, toPath: originalPath)
    }
  }

  private static func tokenizeCommand(_ command: String) -> [String] {
    var tokens: [String] = []
    var current = ""
    var inQuote: Character? = nil
    for ch in command {
      if let q = inQuote {
        if ch == q { inQuote = nil }
        else { current.append(ch) }
      } else if ch == "\"" || ch == "'" {
        inQuote = ch
      } else if ch == " " || ch == "\t" {
        if !current.isEmpty { tokens.append(current); current = "" }
      } else {
        current.append(ch)
      }
    }
    if !current.isEmpty { tokens.append(current) }
    return tokens
  }

  public func definition() -> ModuleDefinition {
    Name("ExpoFfmpeg")

    Events("onProgress")

    AsyncFunction("execute") { [weak self] (command: String, promise: Promise) in
      guard let self = self else {
        promise.reject("ERR_MODULE_DEALLOCATED", "Module was deallocated")
        return
      }

      guard !self.isExecuting else {
        promise.reject("ERR_ALREADY_EXECUTING", "An FFmpeg command is already running. Call cancel() first.")
        return
      }

      self.isExecuting = true

      // iOS sandbox blocks C open() with O_CREAT in Library/Caches.
      // Write to NSTemporaryDirectory (always writable), then move after.
      var outputFd: Int32 = -1
      var originalOutputPath: String? = nil
      var tmpOutputPath: String? = nil
      var effectiveCommand = command
      let tokens = Self.tokenizeCommand(command)
      if let lastToken = tokens.last, !lastToken.hasPrefix("-") {
        originalOutputPath = lastToken
        let fileName = URL(fileURLWithPath: lastToken).lastPathComponent
        let tmpPath = NSTemporaryDirectory() + fileName
        tmpOutputPath = tmpPath

        let fm = FileManager.default
        try? fm.removeItem(atPath: tmpPath)
        fm.createFile(atPath: tmpPath, contents: nil)

        if let handle = FileHandle(forWritingAtPath: tmpPath) {
          handle.truncateFile(atOffset: 0)
          outputFd = Int32(dup(handle.fileDescriptor))
          handle.closeFile()

          // Rewrite the output path in the command to use tmp
          let quoted = "\"\(lastToken)\""
          let quotedTmp = "\"\(tmpPath)\""
          if effectiveCommand.contains(quoted) {
            effectiveCommand = effectiveCommand.replacingOccurrences(of: quoted, with: quotedTmp)
          }
        }
      }

      self.executionQueue.async { [weak self] in
        let startTime = CFAbsoluteTimeGetCurrent()
        let logBufferSize: Int32 = 256 * 1024
        let logBuffer = UnsafeMutablePointer<CChar>.allocate(capacity: Int(logBufferSize))
        logBuffer.initialize(repeating: 0, count: Int(logBufferSize))

        let progressCallback: ffmpeg_progress_callback = { frame, fps, percentage, timeUs, speed in
          NotificationCenter.default.post(
            name: NSNotification.Name("ExpoFfmpegProgress"),
            object: nil,
            userInfo: [
              "frame": Int(frame),
              "fps": fps,
              "time": Double(timeUs) / 1_000_000.0,
              "speed": speed,
              "percentage": Int(percentage)
            ]
          )
        }

        let returnCode = Int(ffmpeg_execute(effectiveCommand, progressCallback, logBuffer, logBufferSize, outputFd))

        var output = String(cString: logBuffer)
        logBuffer.deallocate()

        // Copy output from tmp to the caller's original path.
        // iPadOS 26 blocks ALL write APIs (C-level, Data.write, FileManager) in Library/Caches.
        // Strategy: try the original path first, fall back to Documents, then leave in tmp.
        // Return outputPath so the JS caller knows the actual location.
        var finalOutputPath: String? = nil
        if returnCode == 0, let tmpPath = tmpOutputPath, let origPath = originalOutputPath {
          let resolvedOrig = (origPath as NSString).resolvingSymlinksInPath
          let fm = FileManager.default
          if fm.fileExists(atPath: tmpPath) {
            let tmpSize = (try? fm.attributesOfItem(atPath: tmpPath)[.size] as? Int) ?? 0
            output += " [io] tmpSize=\(tmpSize)"

            // Try moving to original path
            try? fm.removeItem(atPath: resolvedOrig)
            do {
              try fm.moveItem(atPath: tmpPath, toPath: resolvedOrig)
              output += " moved=ok"
              finalOutputPath = resolvedOrig
            } catch {
              // Library/Caches is locked on iPadOS 26 — use Documents instead
              if let docsDir = fm.urls(for: .documentDirectory, in: .userDomainMask).first {
                let docsPath = docsDir.appendingPathComponent(URL(fileURLWithPath: tmpPath).lastPathComponent).path
                try? fm.removeItem(atPath: docsPath)
                do {
                  try fm.moveItem(atPath: tmpPath, toPath: docsPath)
                  output += " movedToDocs=\(docsPath)"
                  finalOutputPath = docsPath
                } catch {
                  output += " moveErr=\(error.localizedDescription)"
                  finalOutputPath = tmpPath
                }
              } else {
                finalOutputPath = tmpPath
              }
            }
          }
        }

        let elapsed = CFAbsoluteTimeGetCurrent() - startTime
        self?.isExecuting = false

        if returnCode == 0 {
          var resultDict: [String: Any] = [
            "returnCode": returnCode,
            "output": output,
            "duration": elapsed
          ]
          if let outPath = finalOutputPath {
            resultDict["outputPath"] = outPath
          }
          promise.resolve(resultDict)
        } else {
          promise.reject(
            "ERR_FFMPEG_EXECUTE",
            "FFmpeg execution failed with code \(returnCode): \(output)"
          )
        }
      }
    }

    Function("cancel") { [weak self] () in
      ffmpeg_cancel()
      self?.isExecuting = false
    }

    AsyncFunction("getMediaInfo") { (path: String, promise: Promise) in
      DispatchQueue.global(qos: .userInitiated).async {
        guard let jsonCStr = ffmpeg_get_media_info(path) else {
          promise.reject("ERR_MEDIA_INFO", "Failed to get media info for: \(path)")
          return
        }

        let jsonString = String(cString: jsonCStr)
        free(jsonCStr)

        guard let data = jsonString.data(using: .utf8),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
          promise.reject("ERR_MEDIA_INFO_PARSE", "Failed to parse media info JSON")
          return
        }

        promise.resolve([
          "duration": json["duration"] as? Double ?? 0.0,
          "width": json["width"] as? Int ?? 0,
          "height": json["height"] as? Int ?? 0,
          "codec": json["codec"] as? String ?? "",
          "bitrate": json["bitrate"] as? Int ?? 0
        ] as [String: Any])
      }
    }

    OnCreate { [weak self] in
      self?.progressObserver = NotificationCenter.default.addObserver(
        forName: NSNotification.Name("ExpoFfmpegProgress"),
        object: nil,
        queue: nil
      ) { [weak self] notification in
        guard let info = notification.userInfo else { return }
        self?.sendEvent("onProgress", [
          "frame": info["frame"] as? Int ?? 0,
          "fps": info["fps"] as? Double ?? 0.0,
          "time": info["time"] as? Double ?? 0.0,
          "speed": info["speed"] as? Double ?? 0.0,
          "percentage": info["percentage"] as? Int ?? 0
        ])
      }
    }

    OnDestroy { [weak self] in
      if let observer = self?.progressObserver {
        NotificationCenter.default.removeObserver(observer)
        self?.progressObserver = nil
      }
      if self?.isExecuting == true {
        ffmpeg_cancel()
      }
    }
  }
}

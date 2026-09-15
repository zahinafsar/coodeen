import Foundation
import CoreServices

enum CoodeenConfigService {
    static func configURL(_ dir: String) -> URL {
        URL(fileURLWithPath: dir).appendingPathComponent("coodeen.json")
    }

    static func exists(_ dir: String) -> Bool {
        FileManager.default.fileExists(atPath: configURL(dir).path)
    }

    static func loadDesign(_ dir: String) -> DesignConfig? {
        guard let json = JSONFileStore.load(configURL(dir)), let design = json["design"] else {
            return nil
        }
        guard let host = design["host"]?.stringValue else {
            return nil
        }
        let pages = (design["pages"]?.arrayValue ?? []).compactMap { page -> DesignPageConfig? in
            guard let route = page["route"]?.stringValue else {
                return nil
            }
            return DesignPageConfig(route: route, compact: page["compact"]?.boolValue ?? false)
        }
        return DesignConfig(host: host, pages: pages)
    }

    static func setPageCompact(_ dir: String, route: String, compact: Bool) throws {
        let url = configURL(dir)
        guard var root = JSONFileStore.load(url)?.objectValue else {
            return
        }
        guard var design = root["design"]?.objectValue, var pages = design["pages"]?.arrayValue else {
            return
        }
        for (i, page) in pages.enumerated() {
            if page["route"]?.stringValue == route, var obj = page.objectValue {
                if compact {
                    obj["compact"] = .bool(true)
                } else {
                    obj.removeValue(forKey: "compact")
                }
                pages[i] = .object(obj)
            }
        }
        design["pages"] = .array(pages)
        root["design"] = .object(design)
        try JSONFileStore.save(url, .object(root))
    }
}

final class FileWatcher {
    private var stream: FSEventStreamRef?
    private let paths: [String]
    private let targetNames: Set<String>
    private let callback: () -> Void

    init(directory: String, fileNames: Set<String>, callback: @escaping () -> Void) {
        self.paths = [(directory as NSString).resolvingSymlinksInPath, directory]
        self.targetNames = fileNames
        self.callback = callback
        start()
    }

    deinit {
        stop()
    }

    private func start() {
        var context = FSEventStreamContext(
            version: 0,
            info: Unmanaged.passUnretained(self).toOpaque(),
            retain: nil,
            release: nil,
            copyDescription: nil
        )
        let flags = UInt32(kFSEventStreamCreateFlagFileEvents | kFSEventStreamCreateFlagUseCFTypes | kFSEventStreamCreateFlagNoDefer)
        let handler: FSEventStreamCallback = { _, info, count, eventPaths, _, _ in
            guard let info else {
                return
            }
            let watcher = Unmanaged<FileWatcher>.fromOpaque(info).takeUnretainedValue()
            let array = Unmanaged<CFArray>.fromOpaque(eventPaths).takeUnretainedValue() as NSArray
            var hit = false
            for i in 0..<count {
                if let path = array[i] as? String {
                    let name = (path as NSString).lastPathComponent
                    let parent = (path as NSString).deletingLastPathComponent
                    if watcher.targetNames.contains(name) && watcher.paths.contains(parent) {
                        hit = true
                    }
                }
            }
            if hit {
                DispatchQueue.main.async {
                    watcher.callback()
                }
            }
        }
        guard let created = FSEventStreamCreate(
            kCFAllocatorDefault,
            handler,
            &context,
            paths as CFArray,
            FSEventStreamEventId(kFSEventStreamEventIdSinceNow),
            0.2,
            flags
        ) else {
            return
        }
        stream = created
        FSEventStreamSetDispatchQueue(created, DispatchQueue.global(qos: .utility))
        FSEventStreamStart(created)
    }

    func stop() {
        guard let stream else {
            return
        }
        FSEventStreamStop(stream)
        FSEventStreamInvalidate(stream)
        FSEventStreamRelease(stream)
        self.stream = nil
    }
}

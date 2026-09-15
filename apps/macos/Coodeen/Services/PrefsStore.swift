import Foundation

struct SessionPrefs {
    var providerId: String?
    var modelId: String?
    var previewUrl: String?
}

final class PrefsStore {
    static let shared = PrefsStore()

    private let queue = DispatchQueue(label: "com.coodeen.prefs")
    private let directory: URL

    private init() {
        let support = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        directory = support.appendingPathComponent("Coodeen", isDirectory: true)
        migrateFromElectron(support: support)
    }

    private var prefsURL: URL {
        directory.appendingPathComponent("session-prefs.json")
    }

    private var configURL: URL {
        directory.appendingPathComponent("app-config.json")
    }

    private func migrateFromElectron(support: URL) {
        let legacy = support.appendingPathComponent("@coodeen/desktop", isDirectory: true)
        let fm = FileManager.default
        try? fm.createDirectory(at: directory, withIntermediateDirectories: true)
        for name in ["session-prefs.json", "app-config.json"] {
            let target = directory.appendingPathComponent(name)
            let source = legacy.appendingPathComponent(name)
            if !fm.fileExists(atPath: target.path) && fm.fileExists(atPath: source.path) {
                try? fm.copyItem(at: source, to: target)
            }
        }
    }

    private func loadAll() -> [String: JSONValue] {
        JSONFileStore.load(prefsURL)?.objectValue ?? [:]
    }

    func prefs(for sessionId: String) -> SessionPrefs {
        queue.sync {
            let entry = loadAll()[sessionId]
            return SessionPrefs(
                providerId: entry?["providerId"]?.stringValue,
                modelId: entry?["modelId"]?.stringValue,
                previewUrl: entry?["previewUrl"]?.stringValue
            )
        }
    }

    func setPrefs(_ sessionId: String, providerId: String? = nil, modelId: String? = nil, previewUrl: String? = nil) {
        queue.sync {
            var all = loadAll()
            var entry = all[sessionId]?.objectValue ?? [:]
            if let providerId {
                entry["providerId"] = .string(providerId)
            }
            if let modelId {
                entry["modelId"] = .string(modelId)
            }
            if let previewUrl {
                entry["previewUrl"] = .string(previewUrl)
            }
            all[sessionId] = .object(entry)
            try? JSONFileStore.save(prefsURL, .object(all))
        }
    }

    func deletePrefs(_ sessionId: String) {
        queue.sync {
            var all = loadAll()
            all.removeValue(forKey: sessionId)
            try? JSONFileStore.save(prefsURL, .object(all))
        }
    }

    func lastModel() -> SessionModel? {
        queue.sync {
            guard
                let config = JSONFileStore.load(configURL),
                let raw = config["last-model"]?.stringValue,
                let slash = raw.firstIndex(of: "/")
            else {
                return nil
            }
            let providerId = String(raw[raw.startIndex..<slash])
            let modelId = String(raw[raw.index(after: slash)...])
            if providerId.isEmpty || modelId.isEmpty {
                return nil
            }
            return SessionModel(providerId: providerId, modelId: modelId)
        }
    }

    func setLastModel(_ model: SessionModel) {
        queue.sync {
            var config = JSONFileStore.load(configURL)?.objectValue ?? [:]
            config["last-model"] = .string("\(model.providerId)/\(model.modelId)")
            try? JSONFileStore.save(configURL, .object(config))
        }
    }
}

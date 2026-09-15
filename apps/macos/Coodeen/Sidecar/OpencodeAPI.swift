import Foundation

enum OpencodeAPI {
    private static var client: OpencodeClient {
        OpencodeClient.shared
    }

    private static func mergeSession(_ json: JSONValue) -> SessionItem? {
        guard let id = json["id"]?.stringValue else {
            return nil
        }
        let prefs = PrefsStore.shared.prefs(for: id)
        return SessionItem(
            id: id,
            title: json["title"]?.stringValue ?? "",
            projectDir: json["directory"]?.stringValue,
            providerId: prefs.providerId,
            modelId: prefs.modelId,
            previewUrl: prefs.previewUrl,
            createdAt: json["time"]?["created"]?.doubleValue ?? 0,
            updatedAt: json["time"]?["updated"]?.doubleValue ?? 0
        )
    }

    static func listSessions() async throws -> [SessionItem] {
        let json = try await client.request("GET", "experimental/session", query: ["roots": "true", "limit": "200"])
        let rows = json.arrayValue ?? []
        return rows.compactMap(mergeSession).sorted { $0.updatedAt > $1.updatedAt }
    }

    static func getSession(_ id: String) async throws -> SessionItem? {
        let json = try await client.request("GET", "session/\(id)")
        return mergeSession(json)
    }

    static func createSession(title: String, model: SessionModel?, projectDir: String?, previewUrl: String?) async throws -> SessionItem {
        let json = try await client.request(
            "POST",
            "session",
            body: .object(["title": .string(title)]),
            directory: projectDir
        )
        guard let id = json["id"]?.stringValue else {
            throw APIError(message: "Session create returned no id")
        }
        if model != nil || previewUrl != nil {
            PrefsStore.shared.setPrefs(id, providerId: model?.providerId, modelId: model?.modelId, previewUrl: previewUrl)
        }
        guard let session = mergeSession(json) else {
            throw APIError(message: "Session create returned no id")
        }
        return session
    }

    static func renameSession(_ id: String, title: String, projectDir: String?) async throws {
        var dir = projectDir
        if dir == nil {
            dir = try? await getSession(id)?.projectDir
        }
        try await client.request("PATCH", "session/\(id)", body: .object(["title": .string(title)]), directory: dir)
    }

    static func deleteSession(_ id: String) async throws {
        try await client.request("DELETE", "session/\(id)")
        PrefsStore.shared.deletePrefs(id)
    }

    static func messages(_ sessionId: String) async throws -> [JSONValue] {
        let json = try await client.request("GET", "session/\(sessionId)/message")
        return json.arrayValue ?? []
    }

    static func prompt(sessionId: String, text: String, model: SessionModel, projectDir: String?, images: [String]) async throws {
        PrefsStore.shared.setPrefs(sessionId, providerId: model.providerId, modelId: model.modelId)
        var parts: [JSONValue] = []
        for dataUrl in images {
            var mime = "image/png"
            if dataUrl.hasPrefix("data:"), let semi = dataUrl.firstIndex(of: ";") {
                mime = String(dataUrl[dataUrl.index(dataUrl.startIndex, offsetBy: 5)..<semi])
            }
            parts.append(.object(["type": .string("file"), "mime": .string(mime), "url": .string(dataUrl)]))
        }
        parts.append(.object(["type": .string("text"), "text": .string(text)]))
        let body: JSONValue = .object([
            "model": .object(["providerID": .string(model.providerId), "modelID": .string(model.modelId)]),
            "parts": .array(parts),
        ])
        try await client.request("POST", "session/\(sessionId)/message", body: body, directory: projectDir)
    }

    static func abort(sessionId: String, projectDir: String?) async {
        _ = try? await client.request("POST", "session/\(sessionId)/abort", directory: projectDir)
    }

    private static var authFileURL: URL {
        FileManager.default.homeDirectoryForCurrentUser
            .appendingPathComponent(".local/share/opencode/auth.json")
    }

    private static var globalConfigURL: URL {
        let env = ProcessInfo.processInfo.environment
        let dir: URL
        if let xdg = env["XDG_CONFIG_HOME"], !xdg.isEmpty {
            dir = URL(fileURLWithPath: xdg).appendingPathComponent("opencode")
        } else {
            dir = FileManager.default.homeDirectoryForCurrentUser.appendingPathComponent(".config/opencode")
        }
        for name in ["opencode.json", "opencode.jsonc", "config.json"] {
            let candidate = dir.appendingPathComponent(name)
            if FileManager.default.fileExists(atPath: candidate.path) {
                return candidate
            }
        }
        return dir.appendingPathComponent("opencode.json")
    }

    static func listProviders() async throws -> [ProviderItem] {
        let json = try await client.request("GET", "config/providers")
        let providers = json["providers"]?.arrayValue ?? []
        let auth = JSONFileStore.load(authFileURL)?.objectValue ?? [:]
        return providers.compactMap { p in
            guard let id = p["id"]?.stringValue else {
                return nil
            }
            let modelsObj = p["models"]?.objectValue ?? [:]
            let models = modelsObj
                .map { key, value in ProviderModelItem(id: key, name: value["name"]?.stringValue ?? key) }
                .sorted { $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending }
            return ProviderItem(
                id: id,
                name: p["name"]?.stringValue ?? id,
                source: p["source"]?.stringValue,
                hasKey: auth[id] != nil,
                authType: auth[id]?["type"]?.stringValue,
                models: models
            )
        }
    }

    private static func disposeCache() async {
        _ = try? await client.request("POST", "global/dispose")
    }

    static func setApiKey(providerId: String, key: String) async throws {
        try await client.request("PUT", "auth/\(providerId)", body: .object(["type": .string("api"), "key": .string(key)]))
        await disposeCache()
    }

    static func deleteApiKey(providerId: String) async throws {
        try await client.request("DELETE", "auth/\(providerId)")
        await disposeCache()
    }

    static func addCustomProvider(_ input: CustomProviderInput) async throws {
        let idPattern = #"^[a-z0-9][a-z0-9-_]*$"#
        if input.id.range(of: idPattern, options: .regularExpression) == nil {
            throw APIError(message: "id must match ^[a-z0-9][a-z0-9-_]*$")
        }
        if !input.baseURL.hasPrefix("http") {
            throw APIError(message: "baseURL must start with http(s)")
        }
        if input.models.isEmpty {
            throw APIError(message: "at least one model required")
        }
        let url = globalConfigURL
        var config = JSONFileStore.load(url)?.objectValue ?? [:]
        var providers = config["provider"]?.objectValue ?? [:]
        var models: [String: JSONValue] = [:]
        for m in input.models {
            var displayName = m.name
            if displayName.isEmpty {
                displayName = m.id
            }
            var entry: [String: JSONValue] = ["name": .string(displayName)]
            if !m.tools {
                entry["tool_call"] = .bool(false)
            }
            models[m.id] = .object(entry)
        }
        var options: [String: JSONValue] = ["baseURL": .string(input.baseURL)]
        if let apiKey = input.apiKey, !apiKey.isEmpty {
            options["apiKey"] = .string(apiKey)
        }
        if let headers = input.headers, !headers.isEmpty {
            options["headers"] = .object(headers.mapValues { .string($0) })
        }
        providers[input.id] = .object([
            "npm": .string("@ai-sdk/openai-compatible"),
            "name": .string(input.name),
            "options": .object(options),
            "models": .object(models),
        ])
        config["provider"] = .object(providers)
        try JSONFileStore.save(url, .object(config))
        _ = try await OpencodeSidecar.shared.restart()
    }

    static func removeCustomProvider(_ id: String) async throws {
        let url = globalConfigURL
        var config = JSONFileStore.load(url)?.objectValue ?? [:]
        var providers = config["provider"]?.objectValue ?? [:]
        if providers[id] == nil {
            return
        }
        providers.removeValue(forKey: id)
        config["provider"] = .object(providers)
        try JSONFileStore.save(url, .object(config))
        _ = try await OpencodeSidecar.shared.restart()
    }

    static func probeOllama(_ baseURL: String) async -> Result<[String], APIError> {
        var trimmed = baseURL
        while trimmed.hasSuffix("/") {
            trimmed.removeLast()
        }
        var tagsBase = trimmed
        if trimmed.hasSuffix("/v1") {
            tagsBase = String(trimmed.dropLast(3))
        }
        if let url = URL(string: "\(tagsBase)/api/tags"),
           let (data, response) = try? await URLSession.shared.data(from: url),
           (response as? HTTPURLResponse)?.statusCode == 200,
           let json = JSONValue.parse(data) {
            let models = (json["models"]?.arrayValue ?? []).compactMap { m -> String? in
                let v = m["model"]?.stringValue ?? m["name"]?.stringValue ?? ""
                if v.isEmpty {
                    return nil
                }
                return v
            }
            if !models.isEmpty {
                return .success(models)
            }
        }
        var v1Base = trimmed
        if !trimmed.hasSuffix("/v1") {
            v1Base = "\(trimmed)/v1"
        }
        guard let url = URL(string: "\(v1Base)/models") else {
            return .failure(APIError(message: "Invalid URL"))
        }
        do {
            let (data, response) = try await URLSession.shared.data(from: url)
            let status = (response as? HTTPURLResponse)?.statusCode ?? 0
            if status != 200 {
                return .failure(APIError(message: "HTTP \(status)"))
            }
            let json = JSONValue.parse(data)
            let models = (json?["data"]?.arrayValue ?? []).compactMap { m -> String? in
                let v = m["id"]?.stringValue ?? ""
                if v.isEmpty {
                    return nil
                }
                return v
            }
            return .success(models)
        } catch {
            return .failure(APIError(message: error.localizedDescription))
        }
    }
}

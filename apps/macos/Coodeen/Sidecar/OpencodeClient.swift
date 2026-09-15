import Foundation

struct APIError: LocalizedError {
    let message: String

    var errorDescription: String? {
        message
    }
}

final class OpencodeClient: @unchecked Sendable {
    static let shared = OpencodeClient()

    let session: URLSession

    private init() {
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 600
        config.timeoutIntervalForResource = 3600
        session = URLSession(configuration: config)
    }

    func baseURL() async throws -> URL {
        try await OpencodeSidecar.shared.start()
    }

    @discardableResult
    func request(
        _ method: String,
        _ path: String,
        query: [String: String] = [:],
        body: JSONValue? = nil,
        directory: String? = nil
    ) async throws -> JSONValue {
        let base = try await baseURL()
        guard var components = URLComponents(url: base.appendingPathComponent(path), resolvingAgainstBaseURL: false) else {
            throw APIError(message: "Invalid URL")
        }
        var items = query.map { URLQueryItem(name: $0.key, value: $0.value) }
        if let directory, !directory.isEmpty {
            items.append(URLQueryItem(name: "directory", value: directory))
        }
        if !items.isEmpty {
            components.queryItems = items
        }
        guard let url = components.url else {
            throw APIError(message: "Invalid URL")
        }
        var req = URLRequest(url: url)
        req.httpMethod = method
        if let directory, !directory.isEmpty {
            let encoded = directory.addingPercentEncoding(withAllowedCharacters: .alphanumerics.union(CharacterSet(charactersIn: "-_.!~*'()"))) ?? directory
            req.setValue(encoded, forHTTPHeaderField: "x-opencode-directory")
        }
        if let body {
            req.setValue("application/json", forHTTPHeaderField: "Content-Type")
            req.httpBody = body.encoded()
        }
        let (data, response) = try await session.data(for: req)
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        let json = JSONValue.parse(data)
        if !(200..<300).contains(status) {
            let message = json?["data"]?["message"]?.stringValue
                ?? json?["message"]?.stringValue
                ?? json?["error"]?.stringValue
                ?? "Request failed: \(status) \(HTTPURLResponse.localizedString(forStatusCode: status))"
            throw APIError(message: message)
        }
        return json ?? .null
    }
}

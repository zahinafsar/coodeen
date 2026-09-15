import Foundation

enum JSONFileStore {
    static func load(_ url: URL) -> JSONValue? {
        guard let data = try? Data(contentsOf: url) else {
            return nil
        }
        return JSONValue.parse(data)
    }

    static func save(_ url: URL, _ value: JSONValue) throws {
        try FileManager.default.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
        try value.encoded(pretty: true).write(to: url, options: .atomic)
    }
}

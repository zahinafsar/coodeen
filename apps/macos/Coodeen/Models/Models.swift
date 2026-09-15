import Foundation

struct SessionItem: Identifiable, Hashable {
    let id: String
    var title: String
    var projectDir: String?
    var providerId: String?
    var modelId: String?
    var previewUrl: String?
    var createdAt: Double
    var updatedAt: Double
}

struct SessionModel: Hashable, Codable {
    var providerId: String
    var modelId: String
}

struct FileReference: Hashable, Identifiable {
    var filePath: String
    var startLine: Int
    var endLine: Int
    var content: String

    var id: String {
        "\(filePath):\(startLine)-\(endLine)"
    }
}

struct ElementSelection: Hashable, Identifiable {
    var component: String
    var file: String
    var line: Int

    var id: String {
        "\(component)-\(file)-\(line)"
    }
}

struct ScreenshotAttachment: Hashable, Identifiable {
    let id: String
    let dataUrl: String
}

struct ProviderModelItem: Hashable, Identifiable {
    let id: String
    let name: String
}

struct ProviderItem: Hashable, Identifiable {
    let id: String
    let name: String
    let source: String?
    let hasKey: Bool
    let authType: String?
    let models: [ProviderModelItem]

    var isUsable: Bool {
        (hasKey || source == "config") && !models.isEmpty
    }

    var isConnected: Bool {
        hasKey || source == "config"
    }
}

struct CustomProviderInput {
    var id: String
    var name: String
    var baseURL: String
    var models: [CustomModelInput]
    var apiKey: String?
    var headers: [String: String]?
}

struct CustomModelInput: Hashable {
    var id: String
    var name: String
    var tools: Bool
}

struct DesignPageConfig: Hashable, Identifiable {
    var route: String
    var compact: Bool

    var id: String {
        route
    }
}

struct DesignConfig: Hashable {
    var host: String
    var pages: [DesignPageConfig]
}

struct ProjectAction: Hashable, Identifiable {
    let label: String
    let script: String

    var id: String {
        label
    }
}

struct TreeEntry: Hashable, Identifiable {
    let name: String
    let isDir: Bool

    var id: String {
        name
    }
}

enum FileContent {
    case text(String, language: String)
    case binary(size: Int)
}

struct GitChange: Hashable, Identifiable {
    let file: String
    let index: String
    let workTree: String
    let status: String

    var id: String {
        file
    }
}

struct GitStatus {
    var isGitRepo: Bool
    var branch: String
    var changes: [GitChange]
    var ahead: Int
    var behind: Int
}

struct GitBranch: Hashable, Identifiable {
    let name: String
    let isCurrent: Bool
    let isRemote: Bool
    let fullRef: String

    var id: String {
        fullRef
    }
}

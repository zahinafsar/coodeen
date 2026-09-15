import Foundation

struct MessageInfo: Hashable, Identifiable {
    let id: String
    var sessionID: String
    var role: String
    var created: Double
    var completed: Double?
    var raw: JSONValue

    init(id: String, sessionID: String, role: String, created: Double, completed: Double?, raw: JSONValue) {
        self.id = id
        self.sessionID = sessionID
        self.role = role
        self.created = created
        self.completed = completed
        self.raw = raw
    }

    init?(json: JSONValue) {
        guard let id = json["id"]?.stringValue, let sid = json["sessionID"]?.stringValue else {
            return nil
        }
        self.id = id
        self.sessionID = sid
        self.role = json["role"]?.stringValue ?? "assistant"
        self.created = json["time"]?["created"]?.doubleValue ?? 0
        self.completed = json["time"]?["completed"]?.doubleValue
        self.raw = json
    }

    var isUser: Bool {
        role == "user"
    }
}

enum ToolStatus: String {
    case pending
    case running
    case completed
    case error
}

struct TodoItem: Hashable {
    let content: String
    let status: String
}

struct MessagePart: Hashable, Identifiable {
    let id: String
    let messageID: String
    let sessionID: String
    let type: String
    var raw: JSONValue

    init?(json: JSONValue) {
        guard
            let id = json["id"]?.stringValue,
            let mid = json["messageID"]?.stringValue,
            let type = json["type"]?.stringValue
        else {
            return nil
        }
        self.id = id
        self.messageID = mid
        self.sessionID = json["sessionID"]?.stringValue ?? ""
        self.type = type
        self.raw = json
    }

    var text: String {
        raw["text"]?.stringValue ?? ""
    }

    var synthetic: Bool {
        raw["synthetic"]?.boolValue ?? false
    }

    var ignored: Bool {
        raw["ignored"]?.boolValue ?? false
    }

    var mime: String {
        raw["mime"]?.stringValue ?? ""
    }

    var url: String {
        raw["url"]?.stringValue ?? ""
    }

    var filename: String? {
        raw["filename"]?.stringValue
    }

    var tool: String {
        raw["tool"]?.stringValue ?? ""
    }

    var toolStatus: ToolStatus {
        ToolStatus(rawValue: raw["state"]?["status"]?.stringValue ?? "") ?? .pending
    }

    var toolInput: JSONValue {
        raw["state"]?["input"] ?? .object([:])
    }

    var toolOutput: String {
        raw["state"]?["output"]?.stringValue ?? ""
    }

    var toolError: String {
        raw["state"]?["error"]?.stringValue ?? ""
    }

    func withText(_ newText: String) -> MessagePart {
        var copy = self
        if case .object(var o) = copy.raw {
            o["text"] = .string(newText)
            copy.raw = .object(o)
        }
        return copy
    }

    var isRenderable: Bool {
        switch type {
        case "text":
            if synthetic || ignored {
                return false
            }
            return !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        case "reasoning":
            return !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        case "tool":
            return true
        case "file":
            return !url.isEmpty
        default:
            return false
        }
    }

    var todos: [TodoItem]? {
        if tool != "todowrite" {
            return nil
        }
        guard let list = toolInput["todos"]?.arrayValue else {
            return nil
        }
        let valid = ["pending", "in_progress", "completed"]
        return list.compactMap { item in
            guard
                let content = item["content"]?.stringValue,
                let status = item["status"]?.stringValue,
                valid.contains(status)
            else {
                return nil
            }
            return TodoItem(content: content, status: status)
        }
    }
}

struct ChatMessage: Hashable, Identifiable {
    var info: MessageInfo
    var parts: [MessagePart]

    var id: String {
        info.id
    }
}

enum SessionStatus: Hashable {
    case idle
    case other(String)

    var isIdle: Bool {
        if case .idle = self {
            return true
        }
        return false
    }
}

struct ChatSessionView {
    var messages: [ChatMessage]
    var status: SessionStatus
    var working: Bool
    var error: String?

    static let empty = ChatSessionView(messages: [], status: .idle, working: false, error: nil)
}

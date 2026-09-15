import Foundation
import Observation

struct SessionEntry {
    var messageOrder: [String] = []
    var messages: [String: MessageInfo] = [:]
    var partsByMessage: [String: [MessagePart]] = [:]
    var status: SessionStatus = .idle
    var error: String?
    var errorCounter = 0
}

@MainActor
@Observable
final class ChatStore {
    private(set) var sessions: [String: SessionEntry] = [:]

    private static let skipParts: Set<String> = ["patch", "step-start", "step-finish"]

    func apply(_ event: OpencodeEvent) {
        let props = event.properties
        switch event.type {
        case "message.updated":
            guard let infoJSON = props["info"], let info = MessageInfo(json: infoJSON) else {
                return
            }
            upsertMessage(info)
        case "message.removed":
            guard let sid = props["sessionID"]?.stringValue, let mid = props["messageID"]?.stringValue else {
                return
            }
            mutate(sid) { s in
                s.messageOrder.removeAll { $0 == mid }
                s.messages.removeValue(forKey: mid)
                s.partsByMessage.removeValue(forKey: mid)
            }
        case "message.part.updated":
            guard let partJSON = props["part"], let part = MessagePart(json: partJSON) else {
                return
            }
            let delta = props["delta"]?.stringValue ?? ""
            upsertPart(part, delta: delta)
        case "message.part.delta":
            guard
                let sid = props["sessionID"]?.stringValue,
                let mid = props["messageID"]?.stringValue,
                let pid = props["partID"]?.stringValue,
                let delta = props["delta"]?.stringValue
            else {
                return
            }
            let field = props["field"]?.stringValue ?? "text"
            if field != "text" {
                return
            }
            mutate(sid) { s in
                guard var list = s.partsByMessage[mid], let idx = list.firstIndex(where: { $0.id == pid }) else {
                    return
                }
                list[idx] = list[idx].withText(list[idx].text + delta)
                s.partsByMessage[mid] = list
            }
        case "message.part.removed":
            guard
                let sid = props["sessionID"]?.stringValue,
                let mid = props["messageID"]?.stringValue,
                let pid = props["partID"]?.stringValue
            else {
                return
            }
            mutate(sid) { s in
                s.partsByMessage[mid]?.removeAll { $0.id == pid }
            }
        case "session.status":
            guard let sid = props["sessionID"]?.stringValue else {
                return
            }
            let type = props["status"]?["type"]?.stringValue ?? "idle"
            mutate(sid) { s in
                if type == "idle" {
                    s.status = .idle
                } else {
                    s.status = .other(type)
                }
            }
        case "session.idle":
            guard let sid = props["sessionID"]?.stringValue else {
                return
            }
            mutate(sid) { s in
                s.status = .idle
            }
        case "session.error":
            let message = props["error"]?["data"]?["message"]?.stringValue
                ?? props["error"]?["message"]?.stringValue
                ?? "Session error"
            guard let sid = props["sessionID"]?.stringValue else {
                return
            }
            mutate(sid) { s in
                s.error = message
                s.errorCounter += 1
            }
        default:
            return
        }
    }

    private func mutate(_ sid: String, _ body: (inout SessionEntry) -> Void) {
        var entry = sessions[sid] ?? SessionEntry()
        body(&entry)
        sessions[sid] = entry
    }

    private func upsertMessage(_ info: MessageInfo) {
        mutate(info.sessionID) { s in
            if s.messages[info.id] == nil {
                var i = s.messageOrder.count
                while i > 0, (s.messages[s.messageOrder[i - 1]]?.created ?? 0) > info.created {
                    i -= 1
                }
                s.messageOrder.insert(info.id, at: i)
            }
            s.messages[info.id] = info
        }
    }

    private func upsertPart(_ part: MessagePart, delta: String) {
        if Self.skipParts.contains(part.type) {
            return
        }
        mutate(part.sessionID) { s in
            var list = s.partsByMessage[part.messageID] ?? []
            var incoming = part
            if !delta.isEmpty && (part.type == "text" || part.type == "reasoning") {
                incoming = part.withText(part.text + delta)
            }
            if let idx = list.firstIndex(where: { $0.id == part.id }) {
                list[idx] = incoming
            } else {
                list.append(incoming)
            }
            if s.messages[part.messageID] == nil {
                let synth = MessageInfo(
                    id: part.messageID,
                    sessionID: part.sessionID,
                    role: "assistant",
                    created: Date().timeIntervalSince1970 * 1000,
                    completed: nil,
                    raw: .null
                )
                s.messages[part.messageID] = synth
                s.messageOrder.append(part.messageID)
            }
            s.partsByMessage[part.messageID] = list
        }
    }

    func hydrate(_ sid: String, items: [JSONValue]) {
        var entry = SessionEntry()
        var pairs: [(MessageInfo, [MessagePart])] = []
        for item in items {
            guard let infoJSON = item["info"], let info = MessageInfo(json: infoJSON) else {
                continue
            }
            let parts = (item["parts"]?.arrayValue ?? [])
                .compactMap(MessagePart.init(json:))
                .filter { !Self.skipParts.contains($0.type) }
            pairs.append((info, parts))
        }
        pairs.sort { $0.0.created < $1.0.created }
        for (info, parts) in pairs {
            entry.messages[info.id] = info
            entry.messageOrder.append(info.id)
            entry.partsByMessage[info.id] = parts
        }
        sessions[sid] = entry
    }

    func clear(_ sid: String) {
        sessions.removeValue(forKey: sid)
    }

    func view(_ sid: String?) -> ChatSessionView {
        guard let sid, let entry = sessions[sid] else {
            return .empty
        }
        let messages = entry.messageOrder.compactMap { id -> ChatMessage? in
            guard let info = entry.messages[id] else {
                return nil
            }
            return ChatMessage(info: info, parts: entry.partsByMessage[id] ?? [])
        }
        let lastAssistant = messages.last { !$0.info.isUser }
        var working = false
        if let lastAssistant, lastAssistant.info.completed == nil {
            working = true
        }
        if !entry.status.isIdle {
            working = true
        }
        return ChatSessionView(messages: messages, status: entry.status, working: working, error: entry.error)
    }

    func errorCounter(_ sid: String?) -> Int {
        guard let sid else {
            return 0
        }
        return sessions[sid]?.errorCounter ?? 0
    }
}

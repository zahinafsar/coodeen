import Foundation

enum JSONValue: Hashable, Codable {
    case null
    case bool(Bool)
    case number(Double)
    case string(String)
    case array([JSONValue])
    case object([String: JSONValue])

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if container.decodeNil() {
            self = .null
        } else if let b = try? container.decode(Bool.self) {
            self = .bool(b)
        } else if let n = try? container.decode(Double.self) {
            self = .number(n)
        } else if let s = try? container.decode(String.self) {
            self = .string(s)
        } else if let a = try? container.decode([JSONValue].self) {
            self = .array(a)
        } else if let o = try? container.decode([String: JSONValue].self) {
            self = .object(o)
        } else {
            self = .null
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        switch self {
        case .null:
            try container.encodeNil()
        case .bool(let b):
            try container.encode(b)
        case .number(let n):
            try container.encode(n)
        case .string(let s):
            try container.encode(s)
        case .array(let a):
            try container.encode(a)
        case .object(let o):
            try container.encode(o)
        }
    }

    subscript(key: String) -> JSONValue? {
        if case .object(let o) = self {
            return o[key]
        }
        return nil
    }

    var stringValue: String? {
        if case .string(let s) = self {
            return s
        }
        return nil
    }

    var doubleValue: Double? {
        if case .number(let n) = self {
            return n
        }
        return nil
    }

    var boolValue: Bool? {
        if case .bool(let b) = self {
            return b
        }
        return nil
    }

    var arrayValue: [JSONValue]? {
        if case .array(let a) = self {
            return a
        }
        return nil
    }

    var objectValue: [String: JSONValue]? {
        if case .object(let o) = self {
            return o
        }
        return nil
    }

    var isNull: Bool {
        if case .null = self {
            return true
        }
        return false
    }

    var displayString: String {
        switch self {
        case .null:
            return ""
        case .bool(let b):
            if b {
                return "true"
            }
            return "false"
        case .number(let n):
            if n.rounded() == n {
                return String(Int(n))
            }
            return String(n)
        case .string(let s):
            return s
        default:
            return ""
        }
    }

    static func parse(_ data: Data) -> JSONValue? {
        try? JSONDecoder().decode(JSONValue.self, from: data)
    }

    func encoded(pretty: Bool = false) -> Data {
        let encoder = JSONEncoder()
        if pretty {
            encoder.outputFormatting = [.prettyPrinted, .sortedKeys, .withoutEscapingSlashes]
        } else {
            encoder.outputFormatting = [.withoutEscapingSlashes]
        }
        return (try? encoder.encode(self)) ?? Data()
    }
}

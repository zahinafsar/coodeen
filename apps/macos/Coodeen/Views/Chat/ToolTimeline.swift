import SwiftUI

struct ToolMeta {
    let icon: String
    let ing: String
    let past: String

    static let table: [String: ToolMeta] = [
        "bash": ToolMeta(icon: "terminal", ing: "Running", past: "Ran"),
        "read": ToolMeta(icon: "doc.text", ing: "Reading", past: "Read"),
        "glob": ToolMeta(icon: "magnifyingglass", ing: "Searching", past: "Searched"),
        "grep": ToolMeta(icon: "magnifyingglass", ing: "Searching", past: "Searched"),
        "edit": ToolMeta(icon: "pencil", ing: "Editing", past: "Edited"),
        "write": ToolMeta(icon: "doc.badge.plus", ing: "Creating", past: "Created"),
        "webfetch": ToolMeta(icon: "link", ing: "Fetching", past: "Fetched"),
        "websearch": ToolMeta(icon: "globe", ing: "Searching web for", past: "Searched web for"),
        "imagefetch": ToolMeta(icon: "photo", ing: "Fetching image", past: "Fetched image"),
        "todowrite": ToolMeta(icon: "checklist", ing: "Planning", past: "Plan"),
        "todoread": ToolMeta(icon: "checklist", ing: "Reading plan", past: "Read plan"),
        "apply_patch": ToolMeta(icon: "pencil", ing: "Applying patch", past: "Applied patch"),
    ]

    static func of(_ name: String) -> ToolMeta {
        table[name] ?? ToolMeta(icon: "terminal", ing: name, past: name)
    }
}

struct ToolTimeline: View {
    let parts: [MessagePart]

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            ForEach(parts) { part in
                ToolRow(part: part)
            }
        }
        .padding(.vertical, 4)
        .background(alignment: .topLeading) {
            RoundedRectangle(cornerRadius: 1)
                .fill(Palette.border)
                .frame(width: 2)
                .padding(.leading, 11)
                .padding(.vertical, 12)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

private struct ToolRow: View {
    let part: MessagePart

    @State private var open = false
    @State private var hovering = false

    var body: some View {
        if let todos = part.todos, !todos.isEmpty {
            TodoListView(todos: todos)
                .padding(.vertical, 4)
        } else {
            standardRow
        }
    }

    private var status: ToolStatus {
        part.toolStatus
    }

    private var isActive: Bool {
        status == .pending || status == .running
    }

    private var summary: String {
        let input = part.toolInput
        switch part.tool {
        case "read", "edit", "write":
            return input["filePath"]?.displayString
                ?? input["file_path"]?.displayString
                ?? input["path"]?.displayString
                ?? ""
        case "glob", "grep":
            return input["pattern"]?.displayString ?? ""
        case "webfetch", "imagefetch":
            return input["url"]?.displayString ?? ""
        case "websearch":
            return input["query"]?.displayString ?? ""
        case "bash":
            let command = input["command"]?.displayString ?? ""
            if command.count > 120 {
                return String(command.prefix(120)) + "..."
            }
            return command
        default:
            return ""
        }
    }

    private var outputSummary: String {
        if status != .completed {
            return ""
        }
        let out = part.toolOutput
        switch part.tool {
        case "glob":
            if out == "No files matched the pattern." {
                return "0 matches"
            }
            return Self.matches(out)
        case "grep":
            if out == "No matches found." {
                return "0 matches"
            }
            return Self.matches(out)
        case "apply_patch":
            let files = out.split(separator: "\n")
                .map { $0.trimmingCharacters(in: .whitespaces) }
                .filter { $0.range(of: #"^[AMD]\s"#, options: .regularExpression) != nil }
            if files.isEmpty {
                return ""
            }
            if files.count == 1 {
                return String(files[0].dropFirst(2))
            }
            return "\(files.count) files"
        default:
            return ""
        }
    }

    private static func matches(_ out: String) -> String {
        let count = out.split(separator: "\n").filter { !$0.isEmpty }.count
        if count == 1 {
            return "1 match"
        }
        return "\(count) matches"
    }

    private var outputText: String {
        switch status {
        case .completed:
            return part.toolOutput
        case .error:
            return "Error: \(part.toolError)"
        default:
            return ""
        }
    }

    private var verb: String {
        let meta = ToolMeta.of(part.tool)
        switch status {
        case .pending, .running:
            return meta.ing
        case .error:
            return "\(meta.past) (failed)"
        case .completed:
            return meta.past
        }
    }

    private var circleBorder: Color {
        if status == .error {
            return Palette.red.opacity(0.5)
        }
        if isActive {
            return Palette.amber.opacity(0.5)
        }
        if hovering {
            return Palette.border
        }
        return Palette.border.opacity(0.6)
    }

    private var circleForeground: Color {
        var strength = 0.7
        if hovering {
            strength = 1
        }
        if status == .error {
            return Palette.red.opacity(strength)
        }
        if isActive {
            return Palette.amber.opacity(strength)
        }
        if hovering {
            return Palette.foreground.opacity(0.9)
        }
        return Palette.mutedForeground
    }

    private var standardRow: some View {
        let canExpand = !outputText.isEmpty
        let isPath = ["read", "edit", "write"].contains(part.tool)

        return VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 12) {
                ZStack {
                    Circle()
                        .fill(Palette.background)
                    Circle()
                        .stroke(circleBorder, lineWidth: 1)
                    if isActive {
                        SpinnerView(size: 10)
                    } else if status == .error {
                        Image(systemName: "exclamationmark.circle")
                            .font(.system(size: 10))
                    } else {
                        Image(systemName: ToolMeta.of(part.tool).icon)
                            .font(.system(size: 10))
                    }
                }
                .foregroundStyle(circleForeground)
                .frame(width: 24, height: 24)

                labelText(isPath: isPath)
                    .font(.system(size: 13))
                    .lineLimit(1)
                    .truncationMode(.tail)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            .padding(.vertical, 5)
            .padding(.trailing, 8)
            .contentShape(Rectangle())
            .onHover { hovering = $0 }
            .onTapGesture {
                if canExpand {
                    open.toggle()
                }
            }

            if open && canExpand {
                ToolOutputView(tool: part.tool, output: outputText, isError: status == .error)
                    .padding(.leading, 40)
                    .padding(.vertical, 4)
            }
        }
    }

    private func labelText(isPath: Bool) -> Text {
        var text = Text(verb)
            .fontWeight(.medium)
            .foregroundColor(hovering ? Palette.foreground.opacity(0.9) : Palette.mutedForeground.opacity(0.7))
        let value = summary
        if !value.isEmpty {
            text = text + Text(" ")
            if isPath {
                var dir = ""
                var name = value
                if let slash = value.lastIndex(of: "/") {
                    dir = String(value[...slash])
                    name = String(value[value.index(after: slash)...])
                }
                text = text
                    + Text(dir)
                        .font(.system(size: 13, design: .monospaced))
                        .foregroundColor(Palette.mutedForeground.opacity(hovering ? 0.6 : 0.4))
                    + Text(name)
                        .font(.system(size: 13, design: .monospaced))
                        .foregroundColor(hovering ? Palette.foreground : Palette.mutedForeground.opacity(0.7))
            } else {
                text = text
                    + Text(value)
                        .font(.system(size: 13, design: .monospaced))
                        .foregroundColor(hovering ? Palette.foreground.opacity(0.8) : Palette.mutedForeground.opacity(0.6))
            }
        }
        let extra = outputSummary
        if !extra.isEmpty {
            text = text + Text("  ·  \(extra)").foregroundColor(Palette.mutedForeground.opacity(hovering ? 0.7 : 0.4))
        }
        return text
    }
}

private struct ToolOutputView: View {
    let tool: String
    let output: String
    let isError: Bool

    var body: some View {
        ScrollView([.horizontal, .vertical]) {
            Text(bodyText)
                .font(.system(size: 11, design: .monospaced))
                .lineSpacing(3)
                .foregroundStyle(isError ? Color(red: 252 / 255, green: 165 / 255, blue: 165 / 255) : Palette.foreground.opacity(0.8))
                .textSelection(.enabled)
                .fixedSize(horizontal: true, vertical: true)
                .padding(.horizontal, 12)
                .padding(.vertical, 8)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .frame(maxHeight: 320)
        .fixedSize(horizontal: false, vertical: true)
        .background(
            RoundedRectangle(cornerRadius: Palette.radiusSm)
                .fill(isError ? Color(red: 69 / 255, green: 10 / 255, blue: 10 / 255).opacity(0.3) : Palette.codeBackground)
        )
        .overlay(
            RoundedRectangle(cornerRadius: Palette.radiusSm)
                .stroke(isError ? Color(red: 127 / 255, green: 29 / 255, blue: 29 / 255).opacity(0.4) : Palette.border.opacity(0.6), lineWidth: 1)
        )
    }

    private var bodyText: String {
        if tool == "read" && !isError {
            if let start = output.range(of: "<content>") {
                var rest = String(output[start.upperBound...])
                if rest.hasPrefix("\n") {
                    rest.removeFirst()
                }
                if let end = rest.range(of: "</content>") {
                    rest = String(rest[..<end.lowerBound])
                }
                while let last = rest.last, last.isWhitespace {
                    rest.removeLast()
                }
                return rest
            }
        }
        return output
    }
}

private struct TodoListView: View {
    let todos: [TodoItem]

    var body: some View {
        let done = todos.filter { $0.status == "completed" }.count

        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 8) {
                Image(systemName: "checklist")
                    .font(.system(size: 11))
                    .foregroundStyle(Palette.mutedForeground)
                Text("Plan")
                    .font(.system(size: 12, weight: .medium))
                    .foregroundStyle(Palette.foreground.opacity(0.9))
                Spacer()
                Text("\(done) / \(todos.count) done")
                    .font(.system(size: 12))
                    .foregroundStyle(Palette.mutedForeground)
            }
            ForEach(Array(todos.enumerated()), id: \.offset) { _, todo in
                HStack(alignment: .firstTextBaseline, spacing: 8) {
                    Image(systemName: icon(todo.status))
                        .font(.system(size: 11))
                        .foregroundStyle(iconColor(todo.status))
                    Text(todo.content)
                        .font(.system(size: 12, weight: todo.status == "in_progress" ? .medium : .regular))
                        .strikethrough(todo.status == "completed")
                        .foregroundStyle(textColor(todo.status))
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
        }
    }

    private func icon(_ status: String) -> String {
        switch status {
        case "completed":
            return "checkmark.circle.fill"
        case "in_progress":
            return "smallcircle.filled.circle"
        default:
            return "circle"
        }
    }

    private func iconColor(_ status: String) -> Color {
        switch status {
        case "completed":
            return Palette.emerald
        case "in_progress":
            return Palette.amber
        default:
            return Palette.mutedForeground.opacity(0.5)
        }
    }

    private func textColor(_ status: String) -> Color {
        switch status {
        case "completed":
            return Palette.mutedForeground
        case "in_progress":
            return Palette.foreground
        default:
            return Palette.foreground.opacity(0.7)
        }
    }
}

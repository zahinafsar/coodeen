import SwiftUI
import AppKit
import SwiftTerm

final class TerminalSession: Identifiable, LocalProcessTerminalViewDelegate {
    let id = UUID()
    let cwd: String
    let label: String
    let view: LocalProcessTerminalView
    var exited = false

    init(cwd: String) {
        self.cwd = cwd
        var name = (cwd as NSString).lastPathComponent
        if name.isEmpty {
            name = "terminal"
        }
        self.label = name
        self.view = LocalProcessTerminalView(frame: NSRect(x: 0, y: 0, width: 600, height: 300))
        configure()
        start()
    }

    private func configure() {
        view.processDelegate = self
        view.font = NSFont.monospacedSystemFont(ofSize: 13, weight: .regular)
        view.nativeBackgroundColor = NSColor(srgbRed: 10 / 255, green: 10 / 255, blue: 10 / 255, alpha: 1)
        view.nativeForegroundColor = NSColor(srgbRed: 228 / 255, green: 228 / 255, blue: 231 / 255, alpha: 1)
        view.caretColor = NSColor(srgbRed: 228 / 255, green: 228 / 255, blue: 231 / 255, alpha: 1)
        view.selectedTextBackgroundColor = NSColor(srgbRed: 39 / 255, green: 39 / 255, blue: 42 / 255, alpha: 1)
        view.optionAsMetaKey = true
        let hex: [UInt32] = [
            0x18181b, 0xef4444, 0x22c55e, 0xeab308, 0x3b82f6, 0xa855f7, 0x06b6d4, 0xe4e4e7,
            0x52525b, 0xf87171, 0x4ade80, 0xfacc15, 0x60a5fa, 0xc084fc, 0x22d3ee, 0xfafafa,
        ]
        let colors = hex.map { value -> SwiftTerm.Color in
            let r = UInt16((value >> 16) & 0xff)
            let g = UInt16((value >> 8) & 0xff)
            let b = UInt16(value & 0xff)
            return SwiftTerm.Color(red: r * 257, green: g * 257, blue: b * 257)
        }
        view.installColors(colors)
        view.getTerminal().options.scrollback = 10000
    }

    private func start() {
        var env = ShellEnvironment.environment()
        env["TERM"] = "xterm-256color"
        env["COLORTERM"] = "truecolor"
        env["LANG"] = env["LANG"] ?? "en_US.UTF-8"
        let pairs = env.map { "\($0.key)=\($0.value)" }
        let shell = ShellEnvironment.shellPath
        let execName = "-" + (shell as NSString).lastPathComponent
        view.startProcess(executable: shell, args: [], environment: pairs, execName: execName, currentDirectory: cwd)
    }

    func terminate() {
        if !exited {
            view.terminate()
        }
    }

    func sizeChanged(source: LocalProcessTerminalView, newCols: Int, newRows: Int) {
    }

    func setTerminalTitle(source: LocalProcessTerminalView, title: String) {
    }

    func hostCurrentDirectoryUpdate(source: TerminalView, directory: String?) {
    }

    func processTerminated(source: TerminalView, exitCode: Int32?) {
        exited = true
    }
}

@MainActor
@Observable
final class TerminalManager {
    private(set) var sessions: [TerminalSession] = []
    var activeId: UUID?

    @ObservationIgnored private var lastDir = ""

    func syncProjectDir(_ dir: String) {
        if dir.isEmpty || dir == lastDir {
            return
        }
        lastDir = dir
        if let existing = sessions.first(where: { $0.cwd == dir }) {
            activeId = existing.id
            return
        }
        let session = TerminalSession(cwd: dir)
        sessions.append(session)
        activeId = session.id
    }

    func add(_ dir: String) {
        if dir.isEmpty {
            return
        }
        let session = TerminalSession(cwd: dir)
        sessions.append(session)
        activeId = session.id
    }

    func close(_ id: UUID) {
        guard let idx = sessions.firstIndex(where: { $0.id == id }) else {
            return
        }
        sessions[idx].terminate()
        sessions[idx].view.removeFromSuperview()
        sessions.remove(at: idx)
        if activeId == id {
            activeId = sessions.last?.id
        }
    }

    func terminateAll() {
        for session in sessions {
            session.terminate()
        }
    }
}

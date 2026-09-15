import SwiftUI
import AppKit

@main
struct CoodeenApp: App {
    @NSApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate
    @State private var app = AppModel()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(app.workspace)
                .environment(app.workspace.toasts)
                .environment(app.terminals)
                .environment(app.preview)
                .environment(app.design)
                .frame(minWidth: 800, minHeight: 600)
                .preferredColorScheme(.dark)
                .task {
                    app.start()
                }
        }
        .defaultSize(width: 1400, height: 900)
        .windowToolbarStyle(.unified(showsTitle: false))
        .commands {
            CommandGroup(replacing: .newItem) {
                Button("New Session") {
                    app.workspace.newSession()
                }
                .keyboardShortcut("n", modifiers: .command)
            }
            CommandGroup(after: .toolbar) {
                Button("Toggle Sessions") {
                    app.workspace.drawerOpen.toggle()
                }
                .keyboardShortcut("s", modifiers: [.command, .shift])
                Button("Toggle Right Panel") {
                    app.workspace.rightPanelOpen.toggle()
                }
                .keyboardShortcut("b", modifiers: [.command, .option])
                Button("Toggle Terminal") {
                    app.workspace.terminalOpen.toggle()
                }
                .keyboardShortcut("j", modifiers: .command)
            }
        }

        Settings {
            SettingsView()
                .environment(app.workspace)
                .environment(app.workspace.toasts)
                .frame(width: 640, height: 560)
                .preferredColorScheme(.dark)
        }
    }
}

@MainActor
@Observable
final class AppModel {
    let workspace: Workspace
    let terminals: TerminalManager
    let preview: PreviewController
    let design: DesignController

    @ObservationIgnored private var started = false

    init() {
        let chat = ChatStore()
        let events = EventBus()
        let toasts = ToastCenter()
        workspace = Workspace(chat: chat, events: events, toasts: toasts)
        terminals = TerminalManager()
        preview = PreviewController()
        design = DesignController()
        AppDelegate.onActivate = { [weak self] in
            self?.workspace.events.reconnect()
        }
        let terminalsRef = terminals
        AppDelegate.onTerminate = {
            MainActor.assumeIsolated {
                terminalsRef.terminateAll()
            }
        }
    }

    func start() {
        if started {
            return
        }
        started = true
        workspace.events.start()
        Task {
            do {
                _ = try await OpencodeSidecar.shared.start()
            } catch {
                workspace.toasts.error(error.localizedDescription)
            }
        }
    }
}

final class AppDelegate: NSObject, NSApplicationDelegate {
    static var onActivate: (() -> Void)?
    static var onTerminate: (() -> Void)?

    private var wasInactive = false

    func applicationDidFinishLaunching(_ notification: Notification) {
        NSWindow.allowsAutomaticWindowTabbing = false
        DispatchQueue.global(qos: .userInitiated).async {
            _ = ShellEnvironment.environment()
        }
    }

    func applicationDidResignActive(_ notification: Notification) {
        wasInactive = true
    }

    func applicationDidBecomeActive(_ notification: Notification) {
        if wasInactive {
            wasInactive = false
            Self.onActivate?()
        }
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        false
    }

    func applicationWillTerminate(_ notification: Notification) {
        Self.onTerminate?()
        OpencodeSidecar.shared.stopSync()
    }
}

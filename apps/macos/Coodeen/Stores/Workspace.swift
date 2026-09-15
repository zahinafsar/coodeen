import Foundation
import Observation
import AppKit

enum RightTab: String, CaseIterable, Identifiable {
    case preview = "Preview"
    case design = "Design"
    case files = "Files"
    case git = "Git"

    var id: String {
        rawValue
    }
}

@MainActor
@Observable
final class Workspace {
    static let defaultPreviewURL = "http://localhost:3000"

    static let generateDesignPrompt = """
    Scan this project, infer how routing is organized, and determine the dev server's host (including the correct port). Then write a file named `coodeen.json` at the project root with exactly this JSON shape (no extra fields, no comments):

    {
      "design": {
        "host": "<scheme>://<host>:<port>",
        "pages": [{ "route": "/" }, { "route": "/some-route" }]
      }
    }

    Include only unique top-level routes the user can visit. Use `/` for the home route. Use the `write` tool to create the file. Do not run any other commands.
    """

    let chat: ChatStore
    let events: EventBus
    let toasts: ToastCenter

    var projectDir: String = "" {
        didSet {
            if projectDir != oldValue {
                projectDirChanged()
            }
        }
    }
    var sessionId: String?
    var model: SessionModel?
    var previewUrl: String = Workspace.defaultPreviewURL
    var drawerOpen = false
    var rightPanelOpen = false
    var rightTab: RightTab = .preview
    var terminalOpen = false
    var generatingDesign = false
    var needsModelAlert = false
    var sessionsRevision = 0

    var fileReferences: [FileReference] = []
    var selections: [ElementSelection] = []
    var screenshots: [ScreenshotAttachment] = []
    var pendingPrefix = ""

    var actions: [ProjectAction] = []
    var runningAction: String?
    var designRevision = 0

    @ObservationIgnored private var configWatcher: FileWatcher?
    @ObservationIgnored private var eventToken: UUID?

    init(chat: ChatStore, events: EventBus, toasts: ToastCenter) {
        self.chat = chat
        self.events = events
        self.toasts = toasts
        self.model = PrefsStore.shared.lastModel()
        eventToken = events.subscribe { [weak self] event in
            self?.chat.apply(event)
        }
    }

    var chatView: ChatSessionView {
        chat.view(sessionId)
    }

    private func projectDirChanged() {
        configWatcher = nil
        if projectDir.isEmpty {
            actions = []
            return
        }
        actions = ActionsService.loadActions(projectDir)
        configWatcher = FileWatcher(directory: projectDir, fileNames: ["coodeen.json"]) { [weak self] in
            self?.coodeenConfigChanged()
        }
    }

    private func coodeenConfigChanged() {
        if projectDir.isEmpty {
            return
        }
        actions = ActionsService.loadActions(projectDir)
        designRevision += 1
        generatingDesign = false
    }

    func setModel(_ next: SessionModel) {
        model = next
        PrefsStore.shared.setLastModel(next)
        if let sessionId {
            PrefsStore.shared.setPrefs(sessionId, providerId: next.providerId, modelId: next.modelId)
        }
    }

    func setPreviewUrl(_ url: String) {
        if url == previewUrl {
            return
        }
        previewUrl = url
        if let sessionId {
            PrefsStore.shared.setPrefs(sessionId, previewUrl: url)
        }
    }

    func loadSession(_ session: SessionItem) async {
        sessionId = session.id
        if let dir = session.projectDir {
            projectDir = dir
        }
        if let url = session.previewUrl {
            previewUrl = url
        }
        if let providerId = session.providerId, let modelId = session.modelId {
            model = SessionModel(providerId: providerId, modelId: modelId)
        }
        do {
            let items = try await OpencodeAPI.messages(session.id)
            chat.hydrate(session.id, items: items)
        } catch {
            toasts.error(error.localizedDescription)
        }
    }

    func newSession() {
        sessionId = nil
        projectDir = ""
    }

    func sessionDeleted(_ id: String) {
        chat.clear(id)
        if sessionId == id {
            sessionId = nil
        }
    }

    func send(_ prompt: String, images: [String] = []) async {
        var sid = sessionId
        if sid == nil && projectDir.isEmpty {
            toasts.error("Select a project folder first")
            return
        }
        guard let model else {
            needsModelAlert = true
            return
        }
        let isFirst = sid == nil
        if sid == nil {
            do {
                var dir: String?
                if !projectDir.isEmpty {
                    dir = projectDir
                }
                let session = try await OpencodeAPI.createSession(
                    title: "New Session",
                    model: model,
                    projectDir: dir,
                    previewUrl: previewUrl
                )
                sid = session.id
                sessionId = session.id
                chat.hydrate(session.id, items: [])
                sessionsRevision += 1
            } catch {
                toasts.error(error.localizedDescription)
                return
            }
        }
        guard let sid else {
            return
        }
        var dir: String?
        if !projectDir.isEmpty {
            dir = projectDir
        }
        if isFirst {
            let title = Self.sessionTitle(prompt)
            Task {
                try? await OpencodeAPI.renameSession(sid, title: title, projectDir: dir)
                self.sessionsRevision += 1
            }
        }
        do {
            try await OpencodeAPI.prompt(sessionId: sid, text: prompt, model: model, projectDir: dir, images: images)
        } catch {
            if !(error is CancellationError) {
                toasts.error(error.localizedDescription)
            }
        }
    }

    func stop() {
        guard let sessionId else {
            return
        }
        var dir: String?
        if !projectDir.isEmpty {
            dir = projectDir
        }
        Task {
            await OpencodeAPI.abort(sessionId: sessionId, projectDir: dir)
        }
    }

    func generateDesignFile() {
        if projectDir.isEmpty {
            toasts.error("Select a project folder first")
            return
        }
        generatingDesign = true
        Task {
            await send(Self.generateDesignPrompt)
        }
    }

    func runAction(_ action: ProjectAction) {
        if projectDir.isEmpty {
            toasts.error("Project directory not set")
            return
        }
        runningAction = action.label
        do {
            try ActionsService.run(projectDir, script: action.script)
            toasts.success("\(action.label) completed")
        } catch {
            toasts.error("\(action.label) failed: \(error.localizedDescription)")
        }
        runningAction = nil
    }

    func addFileReference(_ ref: FileReference) {
        let exists = fileReferences.contains {
            $0.filePath == ref.filePath && $0.startLine == ref.startLine && $0.endLine == ref.endLine
        }
        if !exists {
            fileReferences.append(ref)
        }
    }

    func addScreenshot(_ dataUrl: String) {
        screenshots.append(ScreenshotAttachment(id: UUID().uuidString, dataUrl: dataUrl))
    }

    static func sessionTitle(_ text: String) -> String {
        let collapsed = text
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .components(separatedBy: .whitespacesAndNewlines)
            .filter { !$0.isEmpty }
            .joined(separator: " ")
        if collapsed.count <= 60 {
            return collapsed
        }
        let prefix = String(collapsed.prefix(60)).trimmingCharacters(in: .whitespaces)
        return prefix + "..."
    }
}

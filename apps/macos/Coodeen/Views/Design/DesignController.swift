import Foundation
import WebKit
import AppKit
import Observation

enum DesignMode {
    case preview
    case interact
    case select
}

struct HoverHighlight: Equatable {
    let route: String
    let rect: CGRect
    let label: String
}

@MainActor
@Observable
final class DesignPage: NSObject, Identifiable, WKNavigationDelegate {
    static let nodeWidth: CGFloat = 1920
    static let defaultHeight: CGFloat = 1080
    static let headerHeight: CGFloat = 33
    static let maxHeight: CGFloat = 10000

    let route: String
    let url: String
    var compact: Bool
    var measuredHeight: CGFloat = DesignPage.defaultHeight
    var snapshot: NSImage?
    var loading = true

    @ObservationIgnored let webView: WKWebView
    @ObservationIgnored private var refreshTask: Task<Void, Never>?

    nonisolated var id: String {
        route
    }

    var bodyHeight: CGFloat {
        if compact {
            return DesignPage.defaultHeight
        }
        return measuredHeight
    }

    var nodeHeight: CGFloat {
        bodyHeight + DesignPage.headerHeight
    }

    init(route: String, url: String, compact: Bool, host: NSView) {
        self.route = route
        self.url = url
        self.compact = compact
        let config = WKWebViewConfiguration()
        config.websiteDataStore = .default()
        if #available(macOS 14.0, *) {
            config.preferences.inactiveSchedulingPolicy = .none
        }
        webView = WKWebView(frame: NSRect(x: 0, y: 0, width: DesignPage.nodeWidth, height: DesignPage.defaultHeight), configuration: config)
        super.init()
        webView.navigationDelegate = self
        host.addSubview(webView)
        load()
    }

    func load() {
        guard let target = URL(string: url) else {
            loading = false
            return
        }
        loading = true
        webView.load(URLRequest(url: target))
    }

    func teardown() {
        refreshTask?.cancel()
        webView.stopLoading()
        webView.navigationDelegate = nil
        webView.removeFromSuperview()
    }

    func setCompact(_ value: Bool) {
        compact = value
        resizeWebView()
        scheduleSnapshot(delay: 0.3)
    }

    private func resizeWebView() {
        let h = bodyHeight
        if abs(webView.frame.height - h) > 0.5 {
            webView.frame = NSRect(x: 0, y: 0, width: DesignPage.nodeWidth, height: h)
        }
    }

    nonisolated func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        Task { @MainActor in
            self.loading = false
            await self.measure()
            self.scheduleSnapshot(delay: 0.1)
            try? await Task.sleep(nanoseconds: 800_000_000)
            await self.measure()
            self.scheduleSnapshot(delay: 0.2)
        }
    }

    nonisolated func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        Task { @MainActor in
            self.loading = false
        }
    }

    nonisolated func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        Task { @MainActor in
            self.loading = false
        }
    }

    private func measure() async {
        let script = "Math.max(document.documentElement ? document.documentElement.scrollHeight : 0, document.body ? document.body.scrollHeight : 0)"
        guard let value = try? await webView.evaluateJavaScript(script), let number = value as? NSNumber else {
            return
        }
        let h = CGFloat(number.doubleValue)
        if h <= 0 {
            return
        }
        measuredHeight = min(h, DesignPage.maxHeight)
        resizeWebView()
    }

    func scheduleSnapshot(delay: TimeInterval) {
        refreshTask?.cancel()
        refreshTask = Task { [weak self] in
            try? await Task.sleep(nanoseconds: UInt64(delay * 1_000_000_000))
            if Task.isCancelled {
                return
            }
            await self?.captureSnapshot()
        }
    }

    private func captureSnapshot() async {
        let h = bodyHeight
        let config = WKSnapshotConfiguration()
        config.rect = CGRect(x: 0, y: 0, width: DesignPage.nodeWidth, height: h)
        let factor = min(0.5, 2400 / max(h, 1))
        config.snapshotWidth = NSNumber(value: Double(DesignPage.nodeWidth * factor))
        if let image = try? await webView.takeSnapshot(configuration: config) {
            snapshot = image
        }
    }

    func hitTest(cssPoint: CGPoint) async -> (CGRect, String)? {
        let script = """
        (function(x, y) {
          var el = document.elementFromPoint(x, y);
          if (!el) return null;
          var r = el.getBoundingClientRect();
          var tag = el.tagName.toLowerCase();
          var id = el.id ? '#' + el.id : '';
          var cls = (el.className && typeof el.className === 'string') ? '.' + el.className.trim().split(/\\s+/).join('.') : '';
          return [r.left, r.top, r.width, r.height, tag + id + cls];
        })(\(cssPoint.x), \(cssPoint.y))
        """
        guard let value = try? await webView.evaluateJavaScript(script), let arr = value as? [Any], arr.count == 5 else {
            return nil
        }
        func num(_ i: Int) -> CGFloat {
            CGFloat((arr[i] as? NSNumber)?.doubleValue ?? 0)
        }
        return (CGRect(x: num(0), y: num(1), width: num(2), height: num(3)), arr[4] as? String ?? "")
    }

    func click(cssPoint: CGPoint) async {
        let script = """
        (function(x, y) {
          var el = document.elementFromPoint(x, y);
          if (!el) return;
          if (typeof el.focus === 'function') el.focus();
          var opts = { bubbles: true, cancelable: true, view: window, clientX: x, clientY: y };
          el.dispatchEvent(new MouseEvent('mousedown', opts));
          el.dispatchEvent(new MouseEvent('mouseup', opts));
          el.click();
        })(\(cssPoint.x), \(cssPoint.y))
        """
        _ = try? await webView.evaluateJavaScript(script)
        scheduleSnapshot(delay: 0.7)
    }

    func captureElement(_ rect: CGRect) async -> String? {
        let pad: CGFloat = 4
        let config = WKSnapshotConfiguration()
        config.rect = CGRect(x: rect.minX - pad, y: rect.minY - pad, width: rect.width + pad * 2, height: rect.height + pad * 2)
            .intersection(CGRect(x: 0, y: 0, width: DesignPage.nodeWidth, height: bodyHeight))
        if config.rect.isEmpty {
            return nil
        }
        guard let image = try? await webView.takeSnapshot(configuration: config) else {
            return nil
        }
        return ImageUtils.pngDataURL(from: image)
    }
}

@MainActor
@Observable
final class DesignController {
    var pages: [DesignPage] = []
    var hasConfig = false
    var loaded = false
    var mode: DesignMode = .preview
    var hover: HoverHighlight?

    @ObservationIgnored private var projectDir = ""
    @ObservationIgnored private var lastConfig: DesignConfig?
    @ObservationIgnored private var hostWindow: NSWindow?
    @ObservationIgnored private var hoverInFlight = false

    private func ensureHost() -> NSView? {
        if let hostWindow {
            return hostWindow.contentView
        }
        let window = NSWindow(
            contentRect: NSRect(x: -30000, y: -30000, width: DesignPage.nodeWidth, height: DesignPage.maxHeight),
            styleMask: [.borderless],
            backing: .buffered,
            defer: false
        )
        window.isReleasedWhenClosed = false
        window.ignoresMouseEvents = true
        window.isExcludedFromWindowsMenu = true
        window.collectionBehavior = [.transient, .ignoresCycle, .stationary]
        window.hasShadow = false
        window.alphaValue = 0.01
        window.contentView = FlippedView(frame: NSRect(x: 0, y: 0, width: DesignPage.nodeWidth, height: DesignPage.maxHeight))
        window.orderBack(nil)
        hostWindow = window
        return window.contentView
    }

    func sync(projectDir dir: String) {
        let config: DesignConfig?
        if dir.isEmpty {
            config = nil
        } else {
            config = CoodeenConfigService.loadDesign(dir)
        }
        if dir == projectDir && config == lastConfig && loaded {
            return
        }
        projectDir = dir
        lastConfig = config
        loaded = true
        hasConfig = config != nil
        rebuild(config)
    }

    private func rebuild(_ config: DesignConfig?) {
        guard let config, let host = ensureHost() else {
            for page in pages {
                page.teardown()
            }
            pages = []
            return
        }
        var host0 = config.host
        while host0.hasSuffix("/") {
            host0.removeLast()
        }
        var next: [DesignPage] = []
        for p in config.pages {
            var route = p.route
            if !route.hasPrefix("/") {
                route = "/" + route
            }
            let url = host0 + route
            if let existing = pages.first(where: { $0.route == p.route && $0.url == url }) {
                if existing.compact != p.compact {
                    existing.setCompact(p.compact)
                }
                next.append(existing)
            } else {
                next.append(DesignPage(route: p.route, url: url, compact: p.compact, host: host))
            }
        }
        for page in pages where !next.contains(where: { $0 === page }) {
            page.teardown()
        }
        pages = next
    }

    func toggleCompact(_ page: DesignPage) {
        let value = !page.compact
        page.setCompact(value)
        if projectDir.isEmpty {
            return
        }
        try? CoodeenConfigService.setPageCompact(projectDir, route: page.route, compact: value)
        lastConfig = CoodeenConfigService.loadDesign(projectDir)
    }

    func reload(_ page: DesignPage) {
        page.load()
    }

    func reloadAll() {
        for page in pages {
            page.load()
        }
    }

    static let gap: CGFloat = 60

    func frame(of index: Int) -> CGRect {
        CGRect(
            x: CGFloat(index) * (DesignPage.nodeWidth + DesignController.gap),
            y: 0,
            width: DesignPage.nodeWidth,
            height: pages[index].nodeHeight
        )
    }

    var contentBounds: CGRect {
        var rect = CGRect.null
        for i in pages.indices {
            rect = rect.union(frame(of: i))
        }
        if rect.isNull {
            return .zero
        }
        return rect
    }

    func pageAt(canvasPoint: CGPoint) -> (DesignPage, CGPoint)? {
        for (i, page) in pages.enumerated() {
            let f = frame(of: i)
            let body = CGRect(x: f.minX, y: f.minY + DesignPage.headerHeight, width: f.width, height: page.bodyHeight)
            if body.contains(canvasPoint) {
                return (page, CGPoint(x: canvasPoint.x - body.minX, y: canvasPoint.y - body.minY))
            }
        }
        return nil
    }

    func updateHover(canvasPoint: CGPoint) {
        if mode != .select {
            hover = nil
            return
        }
        guard let hit = pageAt(canvasPoint: canvasPoint) else {
            hover = nil
            return
        }
        let page = hit.0
        let css = hit.1
        if hoverInFlight {
            return
        }
        hoverInFlight = true
        Task {
            let result = await page.hitTest(cssPoint: css)
            hoverInFlight = false
            if let result {
                hover = HoverHighlight(route: page.route, rect: result.0, label: result.1)
            } else {
                hover = nil
            }
        }
    }

    func click(canvasPoint: CGPoint, workspace: Workspace) {
        guard let hit = pageAt(canvasPoint: canvasPoint) else {
            return
        }
        let page = hit.0
        let css = hit.1
        switch mode {
        case .preview:
            return
        case .interact:
            Task {
                await page.click(cssPoint: css)
            }
        case .select:
            Task {
                guard let target = await page.hitTest(cssPoint: css) else {
                    return
                }
                let shot = await page.captureElement(target.0)
                if let shot {
                    workspace.addScreenshot(shot)
                }
                workspace.pendingPrefix = "[route: \(page.route)] "
                hover = nil
                mode = .preview
            }
        }
    }
}

final class FlippedView: NSView {
    override var isFlipped: Bool {
        true
    }
}

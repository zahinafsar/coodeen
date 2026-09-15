import Foundation
import WebKit
import Observation

enum ViewportMode: String, CaseIterable, Identifiable {
    case responsive
    case mobile
    case tablet
    case desktop

    var id: String {
        rawValue
    }

    var label: String {
        switch self {
        case .responsive:
            return "Responsive"
        case .mobile:
            return "Mobile"
        case .tablet:
            return "Tablet"
        case .desktop:
            return "Desktop"
        }
    }

    var icon: String {
        switch self {
        case .mobile:
            return "iphone"
        case .tablet:
            return "ipad"
        default:
            return "desktopcomputer"
        }
    }

    var defaultSize: CGSize {
        switch self {
        case .mobile:
            return CGSize(width: 390, height: 844)
        case .tablet:
            return CGSize(width: 768, height: 1024)
        case .desktop:
            return CGSize(width: 1440, height: 900)
        case .responsive:
            return .zero
        }
    }
}

@MainActor
@Observable
final class PreviewController: NSObject, WKNavigationDelegate, WKScriptMessageHandler {
    let webView: WKWebView

    var loadedURL = ""
    var error = false
    var selecting = false
    var mode: ViewportMode = .responsive
    var vpWidth: CGFloat = 0
    var vpHeight: CGFloat = 0
    var rotated = false

    @ObservationIgnored var onPicked: ((PickedElement, String?) -> Void)?
    @ObservationIgnored private var timeoutTask: Task<Void, Never>?

    override init() {
        let config = WKWebViewConfiguration()
        config.websiteDataStore = .default()
        config.preferences.isElementFullscreenEnabled = true
        let controller = WKUserContentController()
        config.userContentController = controller
        webView = WKWebView(frame: .zero, configuration: config)
        super.init()
        controller.add(WeakScriptHandler(self), name: ElementPickerScript.handlerName)
        webView.navigationDelegate = self
        webView.allowsBackForwardNavigationGestures = true
        if #available(macOS 13.3, *) {
            webView.isInspectable = true
        }
    }

    var effectiveWidth: CGFloat {
        if rotated {
            return vpHeight
        }
        return vpWidth
    }

    var effectiveHeight: CGFloat {
        if rotated {
            return vpWidth
        }
        return vpHeight
    }

    func load(_ urlString: String) {
        error = false
        loadedURL = urlString
        guard let url = URL(string: urlString) else {
            error = true
            return
        }
        startTimeout()
        webView.load(URLRequest(url: url))
    }

    func ensureLoaded(_ urlString: String) {
        if loadedURL != urlString {
            load(urlString)
        }
    }

    func reload() {
        error = false
        startTimeout()
        if webView.url == nil {
            load(loadedURL)
        } else {
            webView.reload()
        }
    }

    func pickMode(_ m: ViewportMode) {
        if m == .responsive || mode == m {
            mode = .responsive
            vpWidth = 0
            vpHeight = 0
            rotated = false
            return
        }
        mode = m
        vpWidth = m.defaultSize.width
        vpHeight = m.defaultSize.height
        rotated = false
    }

    func toggleRotate() {
        if mode == .responsive {
            return
        }
        rotated.toggle()
    }

    func setEffectiveWidth(_ value: CGFloat) {
        if value <= 0 {
            return
        }
        if rotated {
            vpHeight = value
        } else {
            vpWidth = value
        }
    }

    func setEffectiveHeight(_ value: CGFloat) {
        if value <= 0 {
            return
        }
        if rotated {
            vpWidth = value
        } else {
            vpHeight = value
        }
    }

    func toggleSelecting() {
        if selecting {
            cancelSelecting()
        } else {
            selecting = true
            webView.evaluateJavaScript(ElementPickerScript.install)
            webView.window?.makeFirstResponder(webView)
        }
    }

    func cancelSelecting() {
        selecting = false
        webView.evaluateJavaScript(ElementPickerScript.disable)
    }

    private func startTimeout() {
        timeoutTask?.cancel()
        timeoutTask = Task { [weak self] in
            try? await Task.sleep(nanoseconds: 10_000_000_000)
            if Task.isCancelled {
                return
            }
            self?.error = true
        }
    }

    private func clearTimeout() {
        timeoutTask?.cancel()
        timeoutTask = nil
    }

    nonisolated func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        Task { @MainActor in
            self.clearTimeout()
            self.error = false
            if self.selecting {
                webView.evaluateJavaScript(ElementPickerScript.install)
            }
        }
    }

    nonisolated func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        Task { @MainActor in
            self.handleFailure(error)
        }
    }

    nonisolated func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        Task { @MainActor in
            self.handleFailure(error)
        }
    }

    private func handleFailure(_ err: Error) {
        let nsError = err as NSError
        if nsError.code == NSURLErrorCancelled {
            return
        }
        clearTimeout()
        error = true
    }

    nonisolated func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        let body = MainActor.assumeIsolated {
            message.body
        }
        Task { @MainActor in
            if ElementPickerScript.isCancel(body) {
                self.cancelSelecting()
                return
            }
            guard let picked = ElementPickerScript.parse(body) else {
                return
            }
            let shot = await WebSnapshot.capture(self.webView, cssRect: picked.rect)
            self.cancelSelecting()
            self.onPicked?(picked, shot)
        }
    }
}

final class WeakScriptHandler: NSObject, WKScriptMessageHandler {
    weak var target: WKScriptMessageHandler?

    init(_ target: WKScriptMessageHandler) {
        self.target = target
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        target?.userContentController(userContentController, didReceive: message)
    }
}

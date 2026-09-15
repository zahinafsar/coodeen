import SwiftUI
import WebKit

struct PreviewPanel: View {
    @Environment(Workspace.self) private var workspace
    @Environment(PreviewController.self) private var preview

    @State private var input = ""
    @State private var viewportOpen = false

    var body: some View {
        @Bindable var workspace = workspace

        VStack(spacing: 0) {
            HStack(spacing: 6) {
                Button {
                    viewportOpen.toggle()
                } label: {
                    Image(systemName: preview.mode.icon)
                        .font(.system(size: 13))
                        .frame(width: 18, height: 18)
                }
                .buttonStyle(HoverButtonStyle(active: preview.mode != .responsive, padding: 6))
                .help("Viewport settings")
                .popover(isPresented: $viewportOpen, arrowEdge: .bottom) {
                    ViewportPopover()
                }

                TextField("", text: $input)
                    .textFieldStyle(.plain)
                    .font(.system(size: 12, design: .monospaced))
                    .padding(.horizontal, 8)
                    .frame(height: 28)
                    .background(RoundedRectangle(cornerRadius: Palette.radiusSm).fill(Palette.background))
                    .overlay(RoundedRectangle(cornerRadius: Palette.radiusSm).stroke(Palette.border, lineWidth: 1))
                    .onSubmit {
                        let trimmed = input.trimmingCharacters(in: .whitespaces)
                        if !trimmed.isEmpty {
                            workspace.setPreviewUrl(trimmed)
                            preview.load(trimmed)
                        }
                    }

                Button {
                    preview.toggleSelecting()
                } label: {
                    Image(systemName: "cursorarrow.rays")
                        .font(.system(size: 13))
                        .frame(width: 18, height: 18)
                }
                .buttonStyle(HoverButtonStyle(active: preview.selecting, padding: 6))
                .foregroundStyle(preview.selecting ? Palette.blue : Palette.mutedForeground)
                .help(preview.selecting ? "Cancel element selection" : "Select element")

                Button {
                    preview.reload()
                } label: {
                    Image(systemName: "arrow.clockwise")
                        .font(.system(size: 12))
                        .frame(width: 16, height: 16)
                }
                .buttonStyle(HoverButtonStyle(padding: 6))
                .help("Reload preview")

                Button {
                    workspace.terminalOpen.toggle()
                } label: {
                    Image(systemName: "terminal")
                        .font(.system(size: 12))
                        .frame(width: 16, height: 16)
                }
                .buttonStyle(HoverButtonStyle(active: workspace.terminalOpen, padding: 6))
                .help("Toggle terminal")
            }
            .padding(.horizontal, 8)
            .padding(.vertical, 6)
            .background(Palette.card)
            .cardBorder(.bottom)

            ZStack {
                GeometryReader { geo in
                    webArea(container: geo.size)
                }
                if preview.error {
                    errorView
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
        .onAppear {
            input = workspace.previewUrl
            preview.ensureLoaded(workspace.previewUrl)
            preview.onPicked = { _, shot in
                if let shot {
                    workspace.addScreenshot(shot)
                }
            }
        }
        .onChange(of: workspace.previewUrl) { _, url in
            input = url
            preview.ensureLoaded(url)
        }
        .onExitCommand {
            if preview.selecting {
                preview.cancelSelecting()
            }
        }
    }

    @ViewBuilder
    private func webArea(container: CGSize) -> some View {
        if preview.mode == .responsive {
            WebViewHost(webView: preview.webView, zoom: 1)
                .frame(width: container.width, height: container.height)
                .background(Color.white)
        } else {
            let w = max(preview.effectiveWidth, 100)
            let h = max(preview.effectiveHeight, 100)
            let pad: CGFloat = 32
            let scale = min((container.width - pad) / w, (container.height - pad) / h, 1)
            ZStack(alignment: .bottom) {
                Palette.muted.opacity(0.3)
                WebViewHost(webView: preview.webView, zoom: max(scale, 0.05))
                    .frame(width: w * max(scale, 0.05), height: h * max(scale, 0.05))
                    .background(Color.white)
                    .clipShape(RoundedRectangle(cornerRadius: 2))
                    .overlay(RoundedRectangle(cornerRadius: 2).stroke(Palette.border, lineWidth: 1))
                    .shadow(color: .black.opacity(0.3), radius: 6, y: 2)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                Text(sizeLabel(w: w, h: h, scale: scale))
                    .font(.system(size: 10, design: .monospaced))
                    .foregroundStyle(Palette.mutedForeground)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 2)
                    .background(RoundedRectangle(cornerRadius: 4).fill(Palette.card.opacity(0.85)))
                    .overlay(RoundedRectangle(cornerRadius: 4).stroke(Palette.border, lineWidth: 1))
                    .padding(.bottom, 8)
                    .allowsHitTesting(false)
            }
            .frame(width: container.width, height: container.height)
        }
    }

    private func sizeLabel(w: CGFloat, h: CGFloat, scale: CGFloat) -> String {
        var label = "\(Int(w)) × \(Int(h))"
        if scale < 1 {
            label += " (\(Int((scale * 100).rounded()))%)"
        }
        return label
    }

    private var errorView: some View {
        VStack(spacing: 12) {
            Image(systemName: "exclamationmark.triangle")
                .font(.system(size: 34))
                .foregroundStyle(Palette.amber.opacity(0.7))
            Text("Could not load preview. Is your dev server running at \(workspace.previewUrl)?")
                .font(.system(size: 13))
                .foregroundStyle(Palette.mutedForeground)
                .multilineTextAlignment(.center)
                .frame(maxWidth: 360)
            Button("Retry") {
                preview.load(workspace.previewUrl)
            }
            .buttonStyle(OutlineButtonStyle(height: 28))
        }
        .padding(24)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Palette.background)
    }
}

private struct ViewportPopover: View {
    @Environment(PreviewController.self) private var preview

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text("Viewport")
                .font(.system(size: 11, weight: .medium))
                .foregroundStyle(Palette.mutedForeground)
                .padding(.horizontal, 8)
                .padding(.top, 6)
                .padding(.bottom, 4)

            ForEach(ViewportMode.allCases) { m in
                ViewportRow(mode: m, active: preview.mode == m) {
                    preview.pickMode(m)
                }
            }

            if preview.mode != .responsive {
                Divider()
                    .padding(.vertical, 4)
                HStack(spacing: 8) {
                    NumberBox(value: preview.effectiveWidth) { preview.setEffectiveWidth($0) }
                    Text("×")
                        .font(.system(size: 10))
                        .foregroundStyle(Palette.mutedForeground)
                    NumberBox(value: preview.effectiveHeight) { preview.setEffectiveHeight($0) }
                    Button {
                        preview.toggleRotate()
                    } label: {
                        Image(systemName: "arrow.counterclockwise")
                            .font(.system(size: 11))
                    }
                    .buttonStyle(HoverButtonStyle(padding: 4))
                    .help("Rotate")
                }
                .padding(.horizontal, 8)
                .padding(.bottom, 6)
            }
        }
        .padding(6)
        .frame(width: 208)
    }
}

private struct ViewportRow: View {
    let mode: ViewportMode
    let active: Bool
    let action: () -> Void
    @State private var hovering = false

    var body: some View {
        Button(action: action) {
            HStack(spacing: 8) {
                Image(systemName: mode.icon)
                    .font(.system(size: 12))
                    .frame(width: 16)
                Text(mode.label)
                    .font(.system(size: 13))
                Spacer()
                if mode != .responsive {
                    Text("\(Int(mode.defaultSize.width)) × \(Int(mode.defaultSize.height))")
                        .font(.system(size: 10, design: .monospaced))
                        .foregroundStyle(Palette.mutedForeground)
                }
            }
            .padding(.horizontal, 8)
            .padding(.vertical, 6)
            .foregroundStyle(active || hovering ? Palette.foreground : Palette.mutedForeground)
            .background(RoundedRectangle(cornerRadius: 4).fill(active ? Palette.accent : (hovering ? Palette.accent.opacity(0.5) : Color.clear)))
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .onHover { hovering = $0 }
    }
}

private struct NumberBox: View {
    let value: CGFloat
    let onCommit: (CGFloat) -> Void
    @State private var text = ""

    var body: some View {
        TextField("", text: $text)
            .textFieldStyle(.plain)
            .multilineTextAlignment(.center)
            .font(.system(size: 11, design: .monospaced))
            .frame(width: 60, height: 22)
            .background(RoundedRectangle(cornerRadius: 4).fill(Palette.muted))
            .overlay(RoundedRectangle(cornerRadius: 4).stroke(Palette.border, lineWidth: 1))
            .onAppear {
                text = String(Int(value))
            }
            .onChange(of: value) { _, v in
                text = String(Int(v))
            }
            .onChange(of: text) { _, t in
                if let v = Int(t), v > 0 {
                    onCommit(CGFloat(v))
                }
            }
    }
}

struct WebViewHost: NSViewRepresentable {
    let webView: WKWebView
    let zoom: CGFloat

    func makeNSView(context: Context) -> WebContainerView {
        let container = WebContainerView()
        container.attach(webView)
        return container
    }

    func updateNSView(_ container: WebContainerView, context: Context) {
        container.attach(webView)
        if abs(webView.pageZoom - zoom) > 0.001 {
            webView.pageZoom = zoom
        }
    }

    static func dismantleNSView(_ container: WebContainerView, coordinator: ()) {
        container.detach()
    }
}

final class WebContainerView: NSView {
    private weak var hosted: WKWebView?

    func attach(_ webView: WKWebView) {
        if webView.superview === self {
            return
        }
        webView.removeFromSuperview()
        webView.frame = bounds
        webView.autoresizingMask = [.width, .height]
        addSubview(webView)
        hosted = webView
    }

    func detach() {
        if let hosted, hosted.superview === self {
            hosted.removeFromSuperview()
        }
    }

    override func layout() {
        super.layout()
        hosted?.frame = bounds
    }
}

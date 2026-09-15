import SwiftUI
import AppKit

struct DesignCanvasView: View {
    @Environment(Workspace.self) private var workspace
    @Environment(DesignController.self) private var design

    var body: some View {
        Group {
            if workspace.projectDir.isEmpty {
                message("Select a project folder first.")
            } else if !design.loaded {
                SpinnerView(size: 16)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if workspace.generatingDesign {
                VStack(spacing: 12) {
                    SpinnerView(size: 20)
                    Text("Reading project, detecting routes...")
                        .font(.system(size: 13))
                        .foregroundStyle(Palette.mutedForeground)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if !design.hasConfig {
                VStack(spacing: 16) {
                    Text("No design file found. Generate one to scan your project's routes and render them on the canvas.")
                        .font(.system(size: 13))
                        .foregroundStyle(Palette.mutedForeground)
                        .multilineTextAlignment(.center)
                        .frame(maxWidth: 380)
                    Button {
                        workspace.generateDesignFile()
                    } label: {
                        HStack(spacing: 6) {
                            Image(systemName: "sparkles")
                                .font(.system(size: 12))
                            Text("Generate design file")
                        }
                    }
                    .buttonStyle(PrimaryButtonStyle(height: 32))
                }
                .padding(.horizontal, 24)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                DesignCanvas()
            }
        }
        .onAppear {
            design.sync(projectDir: workspace.projectDir)
        }
        .onChange(of: workspace.projectDir) { _, dir in
            design.sync(projectDir: dir)
        }
        .onChange(of: workspace.designRevision) { _, _ in
            design.sync(projectDir: workspace.projectDir)
        }
    }

    private func message(_ text: String) -> some View {
        Text(text)
            .font(.system(size: 13))
            .foregroundStyle(Palette.mutedForeground)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

private struct DesignCanvas: View {
    @Environment(Workspace.self) private var workspace
    @Environment(DesignController.self) private var design

    @State private var zoom: CGFloat = 0.1
    @State private var offset: CGPoint = .zero
    @State private var viewport: CGSize = .zero
    @State private var fitted = false

    private let minZoom: CGFloat = 0.01
    private let maxZoom: CGFloat = 5

    var body: some View {
        GeometryReader { geo in
            ZStack(alignment: .topLeading) {
                Color(red: 10 / 255, green: 10 / 255, blue: 10 / 255)

                GridBackground(zoom: zoom, offset: offset)
                    .allowsHitTesting(false)

                CanvasInput(
                    onPan: { dx, dy in
                        offset = CGPoint(x: offset.x + dx, y: offset.y + dy)
                    },
                    onZoom: { factor, location in
                        zoomBy(factor, around: location)
                    },
                    onMove: { location in
                        design.updateHover(canvasPoint: toCanvas(location))
                    },
                    onClick: { location in
                        design.click(canvasPoint: toCanvas(location), workspace: workspace)
                    },
                    onExit: {
                        design.hover = nil
                    },
                    crosshair: design.mode == .select
                )

                ForEach(Array(design.pages.enumerated()), id: \.element.id) { index, page in
                    pageView(page, index: index)
                }

                if let hover = design.hover, let index = design.pages.firstIndex(where: { $0.route == hover.route }) {
                    hoverOverlay(hover, index: index)
                        .allowsHitTesting(false)
                }

                modeSwitcher
                    .padding(12)

                VStack {
                    Spacer()
                    HStack(alignment: .bottom) {
                        MiniMap(zoom: zoom, offset: offset, viewport: geo.size) { canvasCenter in
                            offset = CGPoint(
                                x: geo.size.width / 2 - canvasCenter.x * zoom,
                                y: geo.size.height / 2 - canvasCenter.y * zoom
                            )
                        }
                        Spacer()
                        zoomControls(size: geo.size)
                    }
                    .padding(12)
                }
            }
            .clipped()
            .onAppear {
                viewport = geo.size
                fitIfNeeded(geo.size)
            }
            .onChange(of: geo.size) { _, size in
                viewport = size
                fitIfNeeded(size)
            }
            .onChange(of: design.pages.map(\.id)) { _, _ in
                fitted = false
                fitIfNeeded(geo.size)
            }
        }
    }

    private func toCanvas(_ p: CGPoint) -> CGPoint {
        CGPoint(x: (p.x - offset.x) / zoom, y: (p.y - offset.y) / zoom)
    }

    private func zoomBy(_ factor: CGFloat, around location: CGPoint) {
        let next = min(max(zoom * factor, minZoom), maxZoom)
        let canvas = toCanvas(location)
        zoom = next
        offset = CGPoint(x: location.x - canvas.x * next, y: location.y - canvas.y * next)
    }

    private func fitIfNeeded(_ size: CGSize) {
        if fitted || size.width <= 0 || size.height <= 0 || design.pages.isEmpty {
            return
        }
        fitted = true
        fit(size)
    }

    private func fit(_ size: CGSize) {
        let bounds = design.contentBounds
        if bounds.width <= 0 || bounds.height <= 0 {
            return
        }
        let padding: CGFloat = 0.2
        let zx = size.width / (bounds.width * (1 + padding))
        let zy = size.height / (bounds.height * (1 + padding))
        let z = min(max(min(zx, zy), minZoom), maxZoom)
        zoom = z
        offset = CGPoint(
            x: size.width / 2 - bounds.midX * z,
            y: size.height / 2 - bounds.midY * z
        )
    }

    @ViewBuilder
    private func pageView(_ page: DesignPage, index: Int) -> some View {
        let frame = design.frame(of: index)
        let screen = CGRect(
            x: offset.x + frame.minX * zoom,
            y: offset.y + frame.minY * zoom,
            width: frame.width * zoom,
            height: frame.height * zoom
        )
        let visible = screen.intersects(CGRect(origin: .zero, size: viewport).insetBy(dx: -200, dy: -200))
        if visible {
            let headerH = DesignPage.headerHeight * zoom
            ZStack(alignment: .topLeading) {
                VStack(spacing: 0) {
                    PageHeader(page: page, interactive: false)
                        .frame(width: DesignPage.nodeWidth, height: DesignPage.headerHeight)
                        .scaleEffect(zoom, anchor: .topLeading)
                        .frame(width: screen.width, height: headerH, alignment: .topLeading)
                    ZStack {
                        Palette.background
                        if let image = page.snapshot {
                            Image(nsImage: image)
                                .resizable()
                                .interpolation(.high)
                                .frame(width: screen.width, height: page.bodyHeight * zoom, alignment: .top)
                        } else if page.loading {
                            SpinnerView(size: 14)
                        }
                    }
                    .frame(width: screen.width, height: page.bodyHeight * zoom)
                    .clipped()
                }
                .background(Palette.card)
                .clipShape(RoundedRectangle(cornerRadius: max(2, 6 * zoom)))
                .overlay(RoundedRectangle(cornerRadius: max(2, 6 * zoom)).stroke(Palette.border, lineWidth: 1))
                .shadow(color: .black.opacity(0.3), radius: 6, y: 2)
                .allowsHitTesting(false)

                PageHeader(page: page, interactive: true)
                    .frame(width: DesignPage.nodeWidth, height: DesignPage.headerHeight)
                    .scaleEffect(zoom, anchor: .topLeading)
                    .frame(width: screen.width, height: headerH, alignment: .topLeading)
            }
            .frame(width: screen.width, height: screen.height)
            .offset(x: screen.minX, y: screen.minY)
        }
    }

    private func hoverOverlay(_ hover: HoverHighlight, index: Int) -> some View {
        let frame = design.frame(of: index)
        let x = offset.x + (frame.minX + hover.rect.minX) * zoom
        let y = offset.y + (frame.minY + DesignPage.headerHeight + hover.rect.minY) * zoom
        return ZStack(alignment: .topLeading) {
            Rectangle()
                .fill(Color(red: 59 / 255, green: 130 / 255, blue: 246 / 255).opacity(0.1))
                .overlay(Rectangle().stroke(Color(red: 59 / 255, green: 130 / 255, blue: 246 / 255), lineWidth: 2))
                .frame(width: max(1, hover.rect.width * zoom), height: max(1, hover.rect.height * zoom))
                .offset(x: x, y: y)
            Text(hover.label)
                .font(.system(size: 11, design: .monospaced))
                .foregroundStyle(Color(red: 205 / 255, green: 214 / 255, blue: 244 / 255))
                .lineLimit(1)
                .padding(.horizontal, 8)
                .padding(.vertical, 3)
                .background(RoundedRectangle(cornerRadius: 4).fill(Color(red: 30 / 255, green: 30 / 255, blue: 46 / 255)))
                .offset(x: x, y: max(0, y - 22))
        }
    }

    private var modeSwitcher: some View {
        HStack(spacing: 0) {
            ModeButton(label: "Preview", icon: "eye", active: design.mode == .preview, accent: false) {
                design.mode = .preview
                design.hover = nil
            }
            ModeButton(label: "Interact", icon: "cursorarrow", active: design.mode == .interact, accent: false) {
                design.mode = .interact
                design.hover = nil
            }
            ModeButton(label: "Select", icon: "cursorarrow.click", active: design.mode == .select, accent: true) {
                design.mode = .select
            }
        }
        .background(RoundedRectangle(cornerRadius: Palette.radiusSm).fill(Palette.card.opacity(0.8)))
        .overlay(RoundedRectangle(cornerRadius: Palette.radiusSm).stroke(Palette.border, lineWidth: 1))
        .clipShape(RoundedRectangle(cornerRadius: Palette.radiusSm))
    }

    private func zoomControls(size: CGSize) -> some View {
        VStack(spacing: 0) {
            controlButton("plus") {
                zoomBy(1.25, around: CGPoint(x: size.width / 2, y: size.height / 2))
            }
            Divider()
            controlButton("minus") {
                zoomBy(0.8, around: CGPoint(x: size.width / 2, y: size.height / 2))
            }
            Divider()
            controlButton("arrow.up.left.and.arrow.down.right") {
                fit(size)
            }
            Divider()
            controlButton("arrow.clockwise") {
                design.reloadAll()
            }
        }
        .frame(width: 30)
        .background(RoundedRectangle(cornerRadius: Palette.radiusSm).fill(Palette.card))
        .overlay(RoundedRectangle(cornerRadius: Palette.radiusSm).stroke(Palette.border, lineWidth: 1))
    }

    private func controlButton(_ icon: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: icon)
                .font(.system(size: 11))
                .frame(width: 30, height: 28)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .foregroundStyle(Palette.foreground)
    }
}

private struct PageHeader: View {
    let page: DesignPage
    let interactive: Bool
    @Environment(DesignController.self) private var design

    var body: some View {
        HStack {
            if interactive {
                Text(page.route)
                    .font(.system(size: 12, design: .monospaced))
                    .lineLimit(1)
                    .hidden()
            } else {
                Text(page.route)
                    .font(.system(size: 12, design: .monospaced))
                    .foregroundStyle(Palette.mutedForeground)
                    .lineLimit(1)
            }
            Spacer()
            Button {
                design.toggleCompact(page)
            } label: {
                Image(systemName: page.compact ? "arrow.up.left.and.arrow.down.right" : "arrow.down.right.and.arrow.up.left")
                    .font(.system(size: 11))
                    .frame(width: 20, height: 20)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .foregroundStyle(Palette.mutedForeground)
            .help(page.compact ? "Auto height" : "Lock to desktop height")
            .opacity(interactive ? 0.001 : 1)
            Button {
                design.reload(page)
            } label: {
                Image(systemName: "arrow.clockwise")
                    .font(.system(size: 11))
                    .frame(width: 20, height: 20)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .foregroundStyle(Palette.mutedForeground)
            .help("Reload")
            .opacity(interactive ? 0.001 : 1)
        }
        .padding(.horizontal, 12)
        .frame(maxHeight: .infinity)
        .background(interactive ? Color.clear : Palette.muted)
        .overlay(alignment: .bottom) {
            if !interactive {
                Rectangle().fill(Palette.border).frame(height: 1)
            }
        }
    }
}

private struct ModeButton: View {
    let label: String
    let icon: String
    let active: Bool
    let accent: Bool
    let action: () -> Void
    @State private var hovering = false

    var body: some View {
        Button(action: action) {
            HStack(spacing: 6) {
                Image(systemName: icon)
                    .font(.system(size: 10))
                Text(label)
                    .font(.system(size: 11))
            }
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .foregroundStyle(foreground)
            .background(background)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .onHover { hovering = $0 }
    }

    private var foreground: Color {
        if active && accent {
            return Color(red: 191 / 255, green: 219 / 255, blue: 254 / 255)
        }
        if active {
            return Color(red: 253 / 255, green: 230 / 255, blue: 138 / 255)
        }
        if hovering {
            return Palette.foreground
        }
        return Palette.mutedForeground
    }

    private var background: Color {
        if active && accent {
            return Color(red: 59 / 255, green: 130 / 255, blue: 246 / 255).opacity(0.2)
        }
        if active {
            return Palette.amber.opacity(0.15)
        }
        return .clear
    }
}

private struct GridBackground: View {
    let zoom: CGFloat
    let offset: CGPoint

    var body: some View {
        Canvas { context, size in
            let spacing = 24 * zoom
            if spacing < 6 {
                return
            }
            let startX = offset.x.truncatingRemainder(dividingBy: spacing)
            let startY = offset.y.truncatingRemainder(dividingBy: spacing)
            let color = Color.white.opacity(0.12)
            var x = startX
            while x < size.width {
                var y = startY
                while y < size.height {
                    context.fill(Path(ellipseIn: CGRect(x: x - 0.5, y: y - 0.5, width: 1, height: 1)), with: .color(color))
                    y += spacing
                }
                x += spacing
            }
        }
    }
}

private struct MiniMap: View {
    let zoom: CGFloat
    let offset: CGPoint
    let viewport: CGSize
    let onNavigate: (CGPoint) -> Void

    @Environment(DesignController.self) private var design

    private let size = CGSize(width: 200, height: 120)

    var body: some View {
        let bounds = design.contentBounds.insetBy(dx: -200, dy: -200)
        let scale = min(size.width / max(bounds.width, 1), size.height / max(bounds.height, 1))
        let contentW = bounds.width * scale
        let contentH = bounds.height * scale
        let originX = (size.width - contentW) / 2
        let originY = (size.height - contentH) / 2

        Canvas { context, _ in
            for i in design.pages.indices {
                let f = design.frame(of: i)
                let r = CGRect(
                    x: originX + (f.minX - bounds.minX) * scale,
                    y: originY + (f.minY - bounds.minY) * scale,
                    width: f.width * scale,
                    height: f.height * scale
                )
                context.fill(Path(r), with: .color(Color.white.opacity(0.25)))
            }
            let visible = CGRect(
                x: originX + ((-offset.x / zoom) - bounds.minX) * scale,
                y: originY + ((-offset.y / zoom) - bounds.minY) * scale,
                width: viewport.width / zoom * scale,
                height: viewport.height / zoom * scale
            )
            context.stroke(Path(visible), with: .color(Palette.blue), lineWidth: 1)
        }
        .frame(width: size.width, height: size.height)
        .background(RoundedRectangle(cornerRadius: Palette.radiusSm).fill(Palette.card.opacity(0.9)))
        .overlay(RoundedRectangle(cornerRadius: Palette.radiusSm).stroke(Palette.border, lineWidth: 1))
        .contentShape(Rectangle())
        .gesture(
            DragGesture(minimumDistance: 0)
                .onChanged { value in
                    let canvasX = bounds.minX + (value.location.x - originX) / scale
                    let canvasY = bounds.minY + (value.location.y - originY) / scale
                    onNavigate(CGPoint(x: canvasX, y: canvasY))
                }
        )
    }
}

private struct CanvasInput: NSViewRepresentable {
    let onPan: (CGFloat, CGFloat) -> Void
    let onZoom: (CGFloat, CGPoint) -> Void
    let onMove: (CGPoint) -> Void
    let onClick: (CGPoint) -> Void
    let onExit: () -> Void
    let crosshair: Bool

    func makeNSView(context: Context) -> CanvasInputNSView {
        let view = CanvasInputNSView()
        apply(view)
        return view
    }

    func updateNSView(_ view: CanvasInputNSView, context: Context) {
        apply(view)
    }

    private func apply(_ view: CanvasInputNSView) {
        view.onPan = onPan
        view.onZoom = onZoom
        view.onMove = onMove
        view.onClick = onClick
        view.onExit = onExit
        if view.crosshair != crosshair {
            view.crosshair = crosshair
            view.window?.invalidateCursorRects(for: view)
        }
    }
}

final class CanvasInputNSView: NSView {
    var onPan: ((CGFloat, CGFloat) -> Void)?
    var onZoom: ((CGFloat, CGPoint) -> Void)?
    var onMove: ((CGPoint) -> Void)?
    var onClick: ((CGPoint) -> Void)?
    var onExit: (() -> Void)?
    var crosshair = false

    private var dragOrigin: CGPoint?
    private var dragged = false
    private var tracking: NSTrackingArea?

    override var isFlipped: Bool {
        true
    }

    override var acceptsFirstResponder: Bool {
        true
    }

    override func acceptsFirstMouse(for event: NSEvent?) -> Bool {
        true
    }

    override func updateTrackingAreas() {
        super.updateTrackingAreas()
        if let tracking {
            removeTrackingArea(tracking)
        }
        let area = NSTrackingArea(
            rect: bounds,
            options: [.mouseMoved, .mouseEnteredAndExited, .activeInKeyWindow, .inVisibleRect, .cursorUpdate],
            owner: self,
            userInfo: nil
        )
        addTrackingArea(area)
        tracking = area
    }

    override func resetCursorRects() {
        if crosshair {
            addCursorRect(bounds, cursor: .crosshair)
        } else {
            addCursorRect(bounds, cursor: .openHand)
        }
    }

    override func cursorUpdate(with event: NSEvent) {
        if crosshair {
            NSCursor.crosshair.set()
        } else {
            NSCursor.openHand.set()
        }
    }

    private func point(_ event: NSEvent) -> CGPoint {
        convert(event.locationInWindow, from: nil)
    }

    override func scrollWheel(with event: NSEvent) {
        let location = point(event)
        if event.modifierFlags.contains(.command) || event.modifierFlags.contains(.control) {
            let delta = event.scrollingDeltaY
            let factor = pow(1.01, delta)
            onZoom?(factor, location)
            return
        }
        var dx = event.scrollingDeltaX
        var dy = event.scrollingDeltaY
        if !event.hasPreciseScrollingDeltas {
            dx *= 10
            dy *= 10
        }
        onPan?(dx, dy)
    }

    override func magnify(with event: NSEvent) {
        onZoom?(1 + event.magnification, point(event))
    }

    override func mouseDown(with event: NSEvent) {
        dragOrigin = point(event)
        dragged = false
        window?.makeFirstResponder(self)
    }

    override func mouseDragged(with event: NSEvent) {
        guard let origin = dragOrigin else {
            return
        }
        let p = point(event)
        let dx = p.x - origin.x
        let dy = p.y - origin.y
        if !dragged && hypot(dx, dy) < 3 {
            return
        }
        dragged = true
        NSCursor.closedHand.set()
        onPan?(dx, dy)
        dragOrigin = p
    }

    override func mouseUp(with event: NSEvent) {
        if !dragged {
            onClick?(point(event))
        }
        dragOrigin = nil
        dragged = false
        cursorUpdate(with: event)
    }

    override func mouseMoved(with event: NSEvent) {
        onMove?(point(event))
    }

    override func mouseExited(with event: NSEvent) {
        onExit?()
    }
}

import SwiftUI
import AppKit

final class PromptTextController {
    weak var textView: PromptNSTextView?

    func prepend(_ prefix: String) {
        guard let textView else {
            return
        }
        let current = textView.string
        textView.string = prefix + current
        textView.didChangeText()
        textView.window?.makeFirstResponder(textView)
        textView.setSelectedRange(NSRange(location: (textView.string as NSString).length, length: 0))
    }

    func clear() {
        guard let textView else {
            return
        }
        textView.string = ""
        textView.didChangeText()
    }

    func focus() {
        guard let textView else {
            return
        }
        textView.window?.makeFirstResponder(textView)
    }
}

final class PromptNSTextView: NSTextView {
    var onSubmit: (() -> Void)?
    var onPasteImage: ((NSImage) -> Void)?
    var placeholder = ""

    override func keyDown(with event: NSEvent) {
        let isReturn = event.keyCode == 36 || event.keyCode == 76
        if isReturn && !event.modifierFlags.contains(.shift) && !hasMarkedText() {
            onSubmit?()
            return
        }
        super.keyDown(with: event)
    }

    override func paste(_ sender: Any?) {
        let pasteboard = NSPasteboard.general
        let hasString = pasteboard.string(forType: .string) != nil
        if !hasString, let images = pasteboard.readObjects(forClasses: [NSImage.self]) as? [NSImage], !images.isEmpty {
            for image in images {
                onPasteImage?(image)
            }
            return
        }
        pasteAsPlainText(sender)
    }

    override func draw(_ dirtyRect: NSRect) {
        super.draw(dirtyRect)
        if string.isEmpty && !placeholder.isEmpty {
            let attrs: [NSAttributedString.Key: Any] = [
                .foregroundColor: NSColor(white: 0.63, alpha: 1),
                .font: font ?? NSFont.systemFont(ofSize: 13),
            ]
            let origin = NSPoint(x: textContainerInset.width + (textContainer?.lineFragmentPadding ?? 0), y: textContainerInset.height)
            (placeholder as NSString).draw(at: origin, withAttributes: attrs)
        }
    }

    override func didChangeText() {
        super.didChangeText()
        needsDisplay = true
    }
}

struct PromptTextView: NSViewRepresentable {
    @Binding var text: String
    @Binding var height: CGFloat
    let placeholder: String
    let fontSize: CGFloat
    let disabled: Bool
    let controller: PromptTextController
    let minHeight: CGFloat
    let maxHeight: CGFloat
    let onSubmit: () -> Void
    let onPasteImage: (NSImage) -> Void

    func makeCoordinator() -> Coordinator {
        Coordinator(parent: self)
    }

    func makeNSView(context: Context) -> NSScrollView {
        let scroll = NSScrollView()
        scroll.drawsBackground = false
        scroll.hasVerticalScroller = true
        scroll.autohidesScrollers = true
        scroll.borderType = .noBorder

        let textView = PromptNSTextView()
        textView.isRichText = false
        textView.importsGraphics = false
        textView.allowsUndo = true
        textView.drawsBackground = false
        textView.font = NSFont.systemFont(ofSize: fontSize)
        textView.textColor = NSColor(white: 0.98, alpha: 1)
        textView.insertionPointColor = NSColor(white: 0.98, alpha: 1)
        textView.isAutomaticQuoteSubstitutionEnabled = false
        textView.isAutomaticDashSubstitutionEnabled = false
        textView.isAutomaticTextReplacementEnabled = false
        textView.isVerticallyResizable = true
        textView.isHorizontallyResizable = false
        textView.autoresizingMask = [.width]
        textView.minSize = NSSize(width: 0, height: 0)
        textView.maxSize = NSSize(width: CGFloat.greatestFiniteMagnitude, height: CGFloat.greatestFiniteMagnitude)
        textView.textContainer?.containerSize = NSSize(width: 0, height: CGFloat.greatestFiniteMagnitude)
        textView.textContainer?.widthTracksTextView = true
        textView.textContainerInset = NSSize(width: 4, height: 8)
        textView.placeholder = placeholder
        textView.delegate = context.coordinator
        textView.unregisterDraggedTypes()
        textView.onSubmit = {
            context.coordinator.parent.onSubmit()
        }
        textView.onPasteImage = { image in
            context.coordinator.parent.onPasteImage(image)
        }
        textView.string = text

        scroll.documentView = textView
        controller.textView = textView
        DispatchQueue.main.async {
            context.coordinator.recalcHeight(textView)
        }
        return scroll
    }

    func updateNSView(_ scroll: NSScrollView, context: Context) {
        context.coordinator.parent = self
        guard let textView = scroll.documentView as? PromptNSTextView else {
            return
        }
        controller.textView = textView
        if textView.string != text {
            textView.string = text
            context.coordinator.recalcHeight(textView)
        }
        textView.isEditable = !disabled
        textView.placeholder = placeholder
        if textView.font?.pointSize != fontSize {
            textView.font = NSFont.systemFont(ofSize: fontSize)
        }
    }

    final class Coordinator: NSObject, NSTextViewDelegate {
        var parent: PromptTextView

        init(parent: PromptTextView) {
            self.parent = parent
        }

        func textDidChange(_ notification: Notification) {
            guard let textView = notification.object as? NSTextView else {
                return
            }
            parent.text = textView.string
            recalcHeight(textView)
        }

        func recalcHeight(_ textView: NSTextView) {
            guard let container = textView.textContainer, let layout = textView.layoutManager else {
                return
            }
            layout.ensureLayout(for: container)
            let used = layout.usedRect(for: container).height + textView.textContainerInset.height * 2
            let next = min(max(used, parent.minHeight), parent.maxHeight)
            if abs(next - parent.height) > 0.5 {
                DispatchQueue.main.async {
                    self.parent.height = next
                }
            }
        }
    }
}

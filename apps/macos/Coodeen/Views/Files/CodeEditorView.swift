import SwiftUI
import AppKit
import HighlightSwift

final class CodeEditorController {
    weak var textView: NSTextView?

    var selectedRange: NSRange {
        textView?.selectedRange() ?? NSRange(location: NSNotFound, length: 0)
    }
}

struct CodeEditorView: NSViewRepresentable {
    @Binding var text: String
    let language: String?
    let controller: CodeEditorController

    static let background = NSColor(srgbRed: 0x1d / 255, green: 0x1f / 255, blue: 0x21 / 255, alpha: 1)
    static let foreground = NSColor(srgbRed: 0xc5 / 255, green: 0xc8 / 255, blue: 0xc6 / 255, alpha: 1)
    static let font = NSFont.monospacedSystemFont(ofSize: 13, weight: .regular)
    static let highlightLimit = 100_000

    func makeCoordinator() -> Coordinator {
        Coordinator(parent: self)
    }

    func makeNSView(context: Context) -> NSScrollView {
        let scroll = NSTextView.scrollableTextView()
        scroll.clipsToBounds = true
        scroll.drawsBackground = true
        scroll.backgroundColor = Self.background
        scroll.hasHorizontalScroller = true
        scroll.autohidesScrollers = true

        guard let textView = scroll.documentView as? NSTextView else {
            return scroll
        }
        textView.isRichText = false
        textView.importsGraphics = false
        textView.allowsUndo = true
        textView.usesFindBar = true
        textView.isIncrementalSearchingEnabled = true
        textView.isAutomaticQuoteSubstitutionEnabled = false
        textView.isAutomaticDashSubstitutionEnabled = false
        textView.isAutomaticTextReplacementEnabled = false
        textView.isAutomaticSpellingCorrectionEnabled = false
        textView.isContinuousSpellCheckingEnabled = false
        textView.smartInsertDeleteEnabled = false
        textView.font = Self.font
        textView.textColor = Self.foreground
        textView.insertionPointColor = Self.foreground
        textView.backgroundColor = Self.background
        textView.selectedTextAttributes = [.backgroundColor: NSColor(srgbRed: 0x37 / 255, green: 0x3b / 255, blue: 0x41 / 255, alpha: 1)]
        textView.textContainerInset = NSSize(width: 6, height: 10)
        textView.isHorizontallyResizable = true
        textView.maxSize = NSSize(width: CGFloat.greatestFiniteMagnitude, height: CGFloat.greatestFiniteMagnitude)
        textView.textContainer?.widthTracksTextView = false
        textView.textContainer?.containerSize = NSSize(width: CGFloat.greatestFiniteMagnitude, height: CGFloat.greatestFiniteMagnitude)
        let paragraph = NSMutableParagraphStyle()
        paragraph.minimumLineHeight = 20
        paragraph.maximumLineHeight = 20
        let tabWidth = CGFloat(2) * (" " as NSString).size(withAttributes: [.font: Self.font]).width
        paragraph.defaultTabInterval = tabWidth
        paragraph.tabStops = []
        textView.defaultParagraphStyle = paragraph
        textView.typingAttributes = [.font: Self.font, .foregroundColor: Self.foreground, .paragraphStyle: paragraph]
        textView.string = text
        textView.textStorage?.setAttributes(textView.typingAttributes, range: NSRange(location: 0, length: (text as NSString).length))
        textView.delegate = context.coordinator

        let ruler = LineNumberRulerView(textView: textView)
        scroll.verticalRulerView = ruler
        scroll.hasVerticalRuler = true
        scroll.rulersVisible = true

        controller.textView = textView
        context.coordinator.scheduleHighlight(textView, delay: 0)
        return scroll
    }

    func updateNSView(_ scroll: NSScrollView, context: Context) {
        context.coordinator.parent = self
        guard let textView = scroll.documentView as? NSTextView else {
            return
        }
        controller.textView = textView
        if textView.string != text {
            textView.string = text
            textView.textStorage?.setAttributes(textView.typingAttributes, range: NSRange(location: 0, length: (text as NSString).length))
            context.coordinator.scheduleHighlight(textView, delay: 0)
            scroll.verticalRulerView?.needsDisplay = true
        }
    }

    final class Coordinator: NSObject, NSTextViewDelegate {
        var parent: CodeEditorView
        private var highlightTask: Task<Void, Never>?
        private let highlighter = Highlight()

        init(parent: CodeEditorView) {
            self.parent = parent
        }

        func textDidChange(_ notification: Notification) {
            guard let textView = notification.object as? NSTextView else {
                return
            }
            parent.text = textView.string
            textView.enclosingScrollView?.verticalRulerView?.needsDisplay = true
            scheduleHighlight(textView, delay: 0.25)
        }

        func textView(_ textView: NSTextView, doCommandBy commandSelector: Selector) -> Bool {
            if commandSelector == #selector(NSResponder.insertTab(_:)) {
                textView.insertText("  ", replacementRange: textView.selectedRange())
                return true
            }
            if commandSelector == #selector(NSResponder.insertNewline(_:)) {
                let ns = textView.string as NSString
                let location = textView.selectedRange().location
                let lineRange = ns.lineRange(for: NSRange(location: min(location, ns.length), length: 0))
                let line = ns.substring(with: lineRange)
                let indent = String(line.prefix { $0 == " " || $0 == "\t" })
                textView.insertText("\n" + indent, replacementRange: textView.selectedRange())
                return true
            }
            return false
        }

        func scheduleHighlight(_ textView: NSTextView, delay: TimeInterval) {
            highlightTask?.cancel()
            let source = textView.string
            if (source as NSString).length > CodeEditorView.highlightLimit || source.isEmpty {
                return
            }
            let language = parent.language
            highlightTask = Task { @MainActor [weak self, weak textView] in
                if delay > 0 {
                    try? await Task.sleep(nanoseconds: UInt64(delay * 1_000_000_000))
                }
                if Task.isCancelled {
                    return
                }
                guard let self else {
                    return
                }
                let result: AttributedString?
                if let language, !language.isEmpty {
                    result = try? await self.highlighter.attributedText(source, language: language, colors: .dark(.atomOne))
                } else {
                    result = nil
                }
                if Task.isCancelled {
                    return
                }
                guard let result, let textView, textView.string == source else {
                    return
                }
                self.apply(result, to: textView, source: source)
            }
        }

        private func apply(_ highlighted: AttributedString, to textView: NSTextView, source: String) {
            guard let storage = textView.textStorage else {
                return
            }
            let colored = NSAttributedString(highlighted)
            let full = source as NSString
            let trimmed = source.trimmingCharacters(in: .whitespacesAndNewlines) as NSString
            if trimmed.length == 0 {
                return
            }
            let offset = full.range(of: trimmed as String).location
            if offset == NSNotFound || colored.length > trimmed.length || !trimmed.hasPrefix(colored.string) {
                return
            }
            let selection = textView.selectedRanges
            storage.beginEditing()
            storage.addAttribute(.foregroundColor, value: CodeEditorView.foreground, range: NSRange(location: 0, length: full.length))
            colored.enumerateAttribute(.foregroundColor, in: NSRange(location: 0, length: colored.length)) { value, range, _ in
                guard let color = value as? NSColor else {
                    return
                }
                storage.addAttribute(.foregroundColor, value: color, range: NSRange(location: range.location + offset, length: range.length))
            }
            storage.endEditing()
            textView.selectedRanges = selection
        }
    }
}

final class LineNumberRulerView: NSRulerView {
    private weak var textView: NSTextView?

    init(textView: NSTextView) {
        self.textView = textView
        super.init(scrollView: textView.enclosingScrollView, orientation: .verticalRuler)
        clientView = textView
        ruleThickness = 48
        clipsToBounds = true
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(refresh),
            name: NSView.boundsDidChangeNotification,
            object: textView.enclosingScrollView?.contentView
        )
    }

    required init(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    @objc private func refresh() {
        needsDisplay = true
    }

    override func drawHashMarksAndLabels(in rect: NSRect) {
        guard
            let textView,
            let layout = textView.layoutManager,
            let container = textView.textContainer
        else {
            return
        }
        let area = rect.intersection(bounds)
        if area.isEmpty {
            return
        }
        NSGraphicsContext.saveGraphicsState()
        defer {
            NSGraphicsContext.restoreGraphicsState()
        }
        NSBezierPath(rect: bounds).addClip()
        CodeEditorView.background.setFill()
        area.fill()
        NSColor(white: 0.3, alpha: 0.5).setFill()
        NSRect(x: bounds.maxX - 1, y: area.minY, width: 1, height: area.height).fill()

        let attrs: [NSAttributedString.Key: Any] = [
            .font: NSFont.monospacedSystemFont(ofSize: 12, weight: .regular),
            .foregroundColor: NSColor(white: 0.45, alpha: 1),
        ]
        let content = textView.string as NSString
        let visible = textView.visibleRect
        let glyphRange = layout.glyphRange(forBoundingRect: visible, in: container)
        let charRange = layout.characterRange(forGlyphRange: glyphRange, actualGlyphRange: nil)
        let inset = textView.textContainerInset.height
        let relative = convert(NSPoint.zero, from: textView)

        var lineNumber = 1
        if charRange.location > 0 {
            let prefix = content.substring(to: charRange.location)
            lineNumber = prefix.reduce(1) { count, ch in
                if ch == "\n" {
                    return count + 1
                }
                return count
            }
        }

        var index = charRange.location
        let end = NSMaxRange(charRange)
        while index <= end && index <= content.length {
            let lineRange = content.lineRange(for: NSRange(location: min(index, content.length), length: 0))
            let glyphIndex = layout.glyphIndexForCharacter(at: min(lineRange.location, max(content.length - 1, 0)))
            var lineRect = layout.lineFragmentRect(forGlyphAt: glyphIndex, effectiveRange: nil)
            if content.length == 0 {
                lineRect = NSRect(x: 0, y: 0, width: 0, height: 20)
            }
            let y = relative.y + lineRect.minY + inset
            let label = "\(lineNumber)" as NSString
            let size = label.size(withAttributes: attrs)
            label.draw(at: NSPoint(x: ruleThickness - size.width - 10, y: y + (lineRect.height - size.height) / 2), withAttributes: attrs)
            lineNumber += 1
            if NSMaxRange(lineRange) <= index {
                break
            }
            index = NSMaxRange(lineRange)
            if index == content.length {
                if content.length > 0 && content.character(at: content.length - 1) == 10 {
                    let extra = layout.extraLineFragmentRect
                    if extra.height > 0 {
                        let label2 = "\(lineNumber)" as NSString
                        let size2 = label2.size(withAttributes: attrs)
                        label2.draw(at: NSPoint(x: ruleThickness - size2.width - 10, y: relative.y + extra.minY + inset + (extra.height - size2.height) / 2), withAttributes: attrs)
                    }
                }
                break
            }
        }
    }
}

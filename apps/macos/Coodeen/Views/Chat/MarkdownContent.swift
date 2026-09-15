import SwiftUI
import MarkdownUI
import HighlightSwift

struct MarkdownContent: View {
    let text: String

    var body: some View {
        Markdown(text)
            .markdownTheme(.coodeen)
            .textSelection(.enabled)
            .frame(maxWidth: .infinity, alignment: .leading)
    }
}

extension MarkdownUI.Theme {
    static let coodeen = MarkdownUI.Theme()
        .text {
            ForegroundColor(Palette.foreground)
            FontSize(13)
        }
        .code {
            FontFamilyVariant(.monospaced)
            FontSize(.em(0.9))
            BackgroundColor(Color.black.opacity(0.3))
        }
        .strong {
            FontWeight(.semibold)
        }
        .link {
            ForegroundColor(Palette.blue)
        }
        .heading1 { configuration in
            configuration.label
                .markdownMargin(top: 16, bottom: 8)
                .markdownTextStyle {
                    FontWeight(.semibold)
                    FontSize(.em(1.6))
                }
        }
        .heading2 { configuration in
            configuration.label
                .markdownMargin(top: 14, bottom: 8)
                .markdownTextStyle {
                    FontWeight(.semibold)
                    FontSize(.em(1.35))
                }
        }
        .heading3 { configuration in
            configuration.label
                .markdownMargin(top: 12, bottom: 6)
                .markdownTextStyle {
                    FontWeight(.semibold)
                    FontSize(.em(1.15))
                }
        }
        .paragraph { configuration in
            configuration.label
                .relativeLineSpacing(.em(0.2))
                .markdownMargin(top: 0, bottom: 10)
        }
        .listItem { configuration in
            configuration.label
                .markdownMargin(top: .em(0.2))
        }
        .blockquote { configuration in
            HStack(spacing: 0) {
                RoundedRectangle(cornerRadius: 2)
                    .fill(Palette.border)
                    .frame(width: 3)
                configuration.label
                    .markdownTextStyle {
                        ForegroundColor(Palette.mutedForeground)
                    }
                    .padding(.leading, 10)
            }
            .fixedSize(horizontal: false, vertical: true)
            .markdownMargin(top: 0, bottom: 10)
        }
        .codeBlock { configuration in
            HighlightedCodeBlock(code: configuration.content, language: configuration.language)
                .markdownMargin(top: 0, bottom: 10)
        }
        .table { configuration in
            configuration.label
                .fixedSize(horizontal: false, vertical: true)
                .markdownTableBorderStyle(.init(color: Palette.border))
                .markdownMargin(top: 0, bottom: 10)
        }
        .tableCell { configuration in
            configuration.label
                .markdownTextStyle {
                    if configuration.row == 0 {
                        FontWeight(.semibold)
                    }
                }
                .padding(.vertical, 5)
                .padding(.horizontal, 10)
        }
}

private let sharedHighlighter = Highlight()

struct HighlightedCodeBlock: View {
    let code: String
    let language: String?

    @State private var highlighted: AttributedString?
    @State private var highlightedSource = ""

    var body: some View {
        ScrollView(.horizontal) {
            Group {
                if let highlighted, highlightedSource == code {
                    Text(highlighted)
                } else {
                    Text(code)
                        .foregroundStyle(Palette.foreground.opacity(0.9))
                }
            }
            .font(.system(size: 12, design: .monospaced))
            .lineSpacing(3)
            .fixedSize(horizontal: true, vertical: true)
            .padding(12)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(RoundedRectangle(cornerRadius: Palette.radiusSm).fill(Color.black.opacity(0.4)))
        .overlay(RoundedRectangle(cornerRadius: Palette.radiusSm).stroke(Palette.border, lineWidth: 1))
        .task(id: code) {
            await highlight()
        }
    }

    private func highlight() async {
        let source = code
        try? await Task.sleep(nanoseconds: 120_000_000)
        if Task.isCancelled {
            return
        }
        do {
            let result: AttributedString
            if let language, !language.isEmpty {
                result = try await sharedHighlighter.attributedText(source, language: language, colors: .dark(.atomOne))
            } else {
                result = try await sharedHighlighter.attributedText(source, colors: .dark(.atomOne))
            }
            if Task.isCancelled {
                return
            }
            highlighted = result
            highlightedSource = source
        } catch {
        }
    }
}

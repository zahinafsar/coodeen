import SwiftUI

struct CatalogEntry: Identifiable, Hashable {
    let id: String
    let name: String
    let note: String
    var recommended = false
}

enum ProviderCatalog {
    static let popular: [CatalogEntry] = [
        CatalogEntry(id: "anthropic", name: "Anthropic", note: "Direct access to Claude models, including Pro and Max", recommended: true),
        CatalogEntry(id: "openai", name: "OpenAI", note: "GPT models for fast, capable general AI tasks"),
        CatalogEntry(id: "google", name: "Google", note: "Gemini models for fast, structured responses"),
        CatalogEntry(id: "zai", name: "Z.AI", note: "GLM models for capable, low-cost coding and chat"),
    ]

    static let niceNames: [String: String] = [
        "zai": "Z.AI",
        "zai-coding-plan": "Z.AI Coding Plan",
        "zhipuai": "Zhipu AI",
        "azure": "Azure OpenAI",
        "amazon-bedrock": "Amazon Bedrock",
        "google-vertex": "Google Vertex",
        "togetherai": "Together AI",
        "cerebras": "Cerebras",
        "cohere": "Cohere",
        "perplexity": "Perplexity",
        "vercel": "Vercel AI Gateway",
        "github-copilot": "GitHub Copilot",
        "gateway": "Gateway",
        "gitlab": "GitLab Duo",
        "kilo": "Kilo",
        "zenmux": "ZenMux",
        "cloudflare-workers-ai": "Cloudflare Workers AI",
        "cloudflare-ai-gateway": "Cloudflare AI Gateway",
        "sap-ai-core": "SAP AI Core",
    ]

    static func displayName(_ id: String, fallback: String? = nil) -> String {
        if let nice = niceNames[id] {
            return nice
        }
        if let fallback, !fallback.isEmpty {
            return fallback
        }
        return id
            .split(whereSeparator: { $0 == "-" || $0 == "_" })
            .map { $0.prefix(1).uppercased() + $0.dropFirst() }
            .joined(separator: " ")
    }

    static func initials(_ name: String) -> String {
        let parts = name.split(whereSeparator: \.isWhitespace)
        if parts.isEmpty {
            return "?"
        }
        if parts.count == 1 {
            return String(parts[0].prefix(2)).uppercased()
        }
        return (String(parts[0].prefix(1)) + String(parts[1].prefix(1))).uppercased()
    }

    static func avatarColor(_ id: String) -> Color {
        var h = 0
        for scalar in id.unicodeScalars {
            h = (h * 31 + Int(scalar.value)) % 360
        }
        return Color(hue: Double(h) / 360, saturation: 0.55, brightness: 0.35 * 1.55)
    }
}

struct ProviderAvatar: View {
    let id: String
    let name: String
    var size: CGFloat = 28

    var body: some View {
        Text(ProviderCatalog.initials(name))
            .font(.system(size: 10, weight: .semibold))
            .foregroundStyle(.white)
            .frame(width: size, height: size)
            .background(RoundedRectangle(cornerRadius: Palette.radiusSm).fill(ProviderCatalog.avatarColor(id)))
    }
}

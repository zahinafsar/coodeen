import SwiftUI

struct ConnectProviderSheet: View {
    let connectedIds: Set<String>
    let onSelectProvider: (CatalogEntry) -> Void
    let onSelectCustom: () -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var query = ""

    private var q: String {
        query.trimmingCharacters(in: .whitespaces).lowercased()
    }

    private var popular: [CatalogEntry] {
        ProviderCatalog.popular
            .filter { !connectedIds.contains($0.id) }
            .filter { entry in
                if q.isEmpty {
                    return true
                }
                return entry.id.lowercased().contains(q)
                    || entry.name.lowercased().contains(q)
                    || entry.note.lowercased().contains(q)
            }
    }

    private var showCustom: Bool {
        q.isEmpty || "custom".contains(q)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("Connect provider")
                .font(.system(size: 16, weight: .semibold))
                .padding(.horizontal, 20)
                .padding(.top, 20)

            HStack(spacing: 6) {
                Image(systemName: "magnifyingglass")
                    .font(.system(size: 12))
                    .foregroundStyle(Palette.mutedForeground)
                TextField("Search providers", text: $query)
                    .textFieldStyle(.plain)
                    .font(.system(size: 13))
                if !query.isEmpty {
                    Button {
                        query = ""
                    } label: {
                        Image(systemName: "xmark")
                            .font(.system(size: 10))
                    }
                    .buttonStyle(.plain)
                    .foregroundStyle(Palette.mutedForeground)
                }
            }
            .padding(.horizontal, 10)
            .frame(height: 34)
            .background(RoundedRectangle(cornerRadius: Palette.radiusSm).fill(Palette.background))
            .overlay(RoundedRectangle(cornerRadius: Palette.radiusSm).stroke(Palette.border, lineWidth: 1))
            .padding(.horizontal, 20)
            .padding(.top, 12)
            .padding(.bottom, 8)

            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    if popular.isEmpty && !showCustom {
                        Text("No providers match.")
                            .font(.system(size: 12))
                            .foregroundStyle(Palette.mutedForeground)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 40)
                    }
                    if !popular.isEmpty {
                        groupLabel("Popular")
                        ForEach(popular) { entry in
                            CatalogRow(entry: entry) {
                                onSelectProvider(entry)
                            }
                        }
                    }
                    if showCustom {
                        groupLabel("Other")
                        CustomCatalogRow(action: onSelectCustom)
                    }
                }
                .padding(.horizontal, 8)
                .padding(.bottom, 12)
            }
            .frame(maxHeight: 420)
        }
        .frame(width: 520)
        .background(Palette.card)
        .foregroundStyle(Palette.foreground)
    }

    private func groupLabel(_ text: String) -> some View {
        Text(text.uppercased())
            .font(.system(size: 10))
            .tracking(0.6)
            .foregroundStyle(Palette.mutedForeground)
            .padding(.horizontal, 12)
            .padding(.top, 8)
            .padding(.bottom, 4)
    }
}

private struct CatalogRow: View {
    let entry: CatalogEntry
    let action: () -> Void
    @State private var hovering = false

    var body: some View {
        Button(action: action) {
            HStack(spacing: 12) {
                ProviderAvatar(id: entry.id, name: entry.name)
                VStack(alignment: .leading, spacing: 2) {
                    HStack(spacing: 8) {
                        Text(entry.name)
                            .font(.system(size: 13, weight: .medium))
                        if entry.recommended {
                            BadgeView(text: "Recommended")
                        }
                    }
                    Text(entry.note)
                        .font(.system(size: 11))
                        .foregroundStyle(Palette.mutedForeground)
                        .lineLimit(1)
                }
                Spacer()
                Text("Connect")
                    .font(.system(size: 12))
                    .foregroundStyle(Palette.mutedForeground)
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .background(RoundedRectangle(cornerRadius: Palette.radiusSm).fill(hovering ? Palette.accent : Color.clear))
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .onHover { hovering = $0 }
    }
}

private struct CustomCatalogRow: View {
    let action: () -> Void
    @State private var hovering = false

    var body: some View {
        Button(action: action) {
            HStack(spacing: 12) {
                Image(systemName: "slider.horizontal.3")
                    .font(.system(size: 12))
                    .foregroundStyle(Palette.mutedForeground)
                    .frame(width: 28, height: 28)
                    .background(RoundedRectangle(cornerRadius: Palette.radiusSm).fill(Palette.muted))
                Text("Custom")
                    .font(.system(size: 13, weight: .medium))
                BadgeView(text: "Custom", outline: true)
                Spacer()
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .background(RoundedRectangle(cornerRadius: Palette.radiusSm).fill(hovering ? Palette.accent : Color.clear))
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .onHover { hovering = $0 }
    }
}

struct ConnectKeySheet: View {
    let entry: CatalogEntry
    let onBack: () -> Void
    let onConnected: () -> Void

    @Environment(\.dismiss) private var dismiss
    @Environment(ToastCenter.self) private var toasts
    @State private var key = ""
    @State private var saving = false

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack(spacing: 12) {
                Button(action: onBack) {
                    Image(systemName: "chevron.left")
                        .font(.system(size: 12))
                }
                .buttonStyle(HoverButtonStyle(padding: 6))
                .help("Back")
                ProviderAvatar(id: entry.id, name: entry.name, size: 32)
                VStack(alignment: .leading, spacing: 2) {
                    Text("Connect \(entry.name)")
                        .font(.system(size: 15, weight: .semibold))
                    Text(entry.note)
                        .font(.system(size: 12))
                        .foregroundStyle(Palette.mutedForeground)
                }
            }

            VStack(alignment: .leading, spacing: 6) {
                Text("API Key")
                    .font(.system(size: 12))
                ThemedTextField(placeholder: "Paste your API key", text: $key, monospaced: true, secure: true) {
                    Task {
                        await save()
                    }
                }
            }

            HStack {
                Spacer()
                Button("Cancel") {
                    dismiss()
                }
                .buttonStyle(OutlineButtonStyle(height: 30))
                Button {
                    Task {
                        await save()
                    }
                } label: {
                    HStack(spacing: 6) {
                        if saving {
                            SpinnerView(size: 10)
                        }
                        Text("Connect")
                    }
                }
                .buttonStyle(PrimaryButtonStyle(height: 30))
                .disabled(saving || key.trimmingCharacters(in: .whitespaces).isEmpty)
            }
        }
        .padding(20)
        .frame(width: 440)
        .background(Palette.card)
        .foregroundStyle(Palette.foreground)
    }

    private func save() async {
        let trimmed = key.trimmingCharacters(in: .whitespacesAndNewlines)
        if trimmed.isEmpty {
            toasts.error("API key required.")
            return
        }
        saving = true
        do {
            try await OpencodeAPI.setApiKey(providerId: entry.id, key: trimmed)
            toasts.success("\(entry.name) connected.")
            onConnected()
            dismiss()
        } catch {
            toasts.error(error.localizedDescription)
        }
        saving = false
    }
}

struct CustomProviderSheet: View {
    let onSaved: () -> Void

    @Environment(\.dismiss) private var dismiss
    @Environment(ToastCenter.self) private var toasts

    @State private var id = ""
    @State private var name = ""
    @State private var baseURL = ""
    @State private var apiKey = ""
    @State private var models: [CustomModelInput] = [CustomModelInput(id: "", name: "", tools: true)]
    @State private var probing = false
    @State private var saving = false
    @FocusState private var baseFocused: Bool

    private static let ollamaDefault = "http://localhost:11434/v1"

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            VStack(alignment: .leading, spacing: 4) {
                Text("Custom provider")
                    .font(.system(size: 16, weight: .semibold))
                Text("Any OpenAI-compatible endpoint. Use the Ollama preset for a local install.")
                    .font(.system(size: 12))
                    .foregroundStyle(Palette.mutedForeground)
            }

            HStack {
                Spacer()
                Button {
                    ollamaPreset()
                } label: {
                    HStack(spacing: 6) {
                        Image(systemName: "sparkles")
                            .font(.system(size: 11))
                        Text("Ollama preset")
                    }
                }
                .buttonStyle(HoverButtonStyle(padding: 6))
            }

            HStack(spacing: 12) {
                labeled("ID") {
                    ThemedTextField(placeholder: "ollama", text: Binding(get: { id }, set: { id = $0.lowercased() }), monospaced: true)
                }
                labeled("Name") {
                    ThemedTextField(placeholder: "Ollama", text: $name)
                }
            }

            labeled("Base URL") {
                HStack(spacing: 6) {
                    ThemedTextField(placeholder: Self.ollamaDefault, text: $baseURL, monospaced: true)
                        .focused($baseFocused)
                        .onChange(of: baseFocused) { _, focused in
                            if !focused && !baseURL.trimmingCharacters(in: .whitespaces).isEmpty && !models.contains(where: { !$0.id.isEmpty }) {
                                Task {
                                    await probe(nil)
                                }
                            }
                        }
                    Button {
                        Task {
                            await probe(nil)
                        }
                    } label: {
                        if probing {
                            SpinnerView(size: 10)
                        } else {
                            Text("Discover")
                        }
                    }
                    .buttonStyle(OutlineButtonStyle(height: 30))
                    .disabled(probing || baseURL.trimmingCharacters(in: .whitespaces).isEmpty)
                }
            }

            labeled("API Key (optional)") {
                ThemedTextField(placeholder: "leave empty for local Ollama", text: $apiKey, monospaced: true, secure: true)
            }

            VStack(alignment: .leading, spacing: 6) {
                HStack {
                    Text("Models")
                        .font(.system(size: 12))
                    Spacer()
                    Button {
                        models.append(CustomModelInput(id: "", name: "", tools: true))
                    } label: {
                        HStack(spacing: 4) {
                            Image(systemName: "plus")
                                .font(.system(size: 11))
                            Text("Add model")
                        }
                    }
                    .buttonStyle(HoverButtonStyle(padding: 6))
                }
                ScrollView {
                    VStack(spacing: 6) {
                        ForEach(models.indices, id: \.self) { i in
                            HStack(spacing: 6) {
                                ThemedTextField(placeholder: "model id (e.g. llama3.1)", text: $models[i].id, monospaced: true)
                                ThemedTextField(placeholder: "display name", text: $models[i].name)
                                Toggle("tools", isOn: $models[i].tools)
                                    .toggleStyle(.checkbox)
                                    .font(.system(size: 10))
                                    .help("Model supports tool calling (uncheck for Gemma, Phi, etc.)")
                                Button {
                                    if models.count > 1 {
                                        models.remove(at: i)
                                    }
                                } label: {
                                    Image(systemName: "trash")
                                        .font(.system(size: 12))
                                }
                                .buttonStyle(HoverButtonStyle(padding: 6))
                                .disabled(models.count == 1)
                            }
                        }
                    }
                }
                .frame(maxHeight: 180)
            }

            HStack {
                Spacer()
                Button("Cancel") {
                    dismiss()
                }
                .buttonStyle(HoverButtonStyle(padding: 6))
                Button {
                    Task {
                        await save()
                    }
                } label: {
                    HStack(spacing: 6) {
                        if saving {
                            SpinnerView(size: 10)
                        }
                        Text("Save provider")
                    }
                }
                .buttonStyle(PrimaryButtonStyle(height: 30))
                .disabled(saving)
            }
        }
        .padding(20)
        .frame(width: 560)
        .background(Palette.card)
        .foregroundStyle(Palette.foreground)
    }

    private func labeled<Content: View>(_ label: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(label)
                .font(.system(size: 12))
            content()
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func ollamaPreset() {
        if id.isEmpty {
            id = "ollama"
        }
        if name.isEmpty {
            name = "Ollama"
        }
        baseURL = Self.ollamaDefault
        Task {
            await probe(Self.ollamaDefault)
        }
    }

    private func probe(_ override: String?) async {
        let url = (override ?? baseURL).trimmingCharacters(in: .whitespaces)
        if url.isEmpty {
            toasts.error("Set baseURL first.")
            return
        }
        probing = true
        let result = await OpencodeAPI.probeOllama(url)
        probing = false
        switch result {
        case .success(let found):
            if found.isEmpty {
                toasts.error("No models found at baseURL.")
                return
            }
            models = found.map { CustomModelInput(id: $0, name: $0, tools: true) }
            if found.count == 1 {
                toasts.success("Found 1 model.")
            } else {
                toasts.success("Found \(found.count) models.")
            }
        case .failure(let error):
            toasts.error(error.message)
        }
    }

    private func save() async {
        if id.range(of: #"^[a-z0-9][a-z0-9-_]*$"#, options: .regularExpression) == nil {
            toasts.error("id must be lowercase, start with letter/digit.")
            return
        }
        if name.trimmingCharacters(in: .whitespaces).isEmpty {
            toasts.error("Name required.")
            return
        }
        if !baseURL.hasPrefix("http") {
            toasts.error("baseURL must start with http(s).")
            return
        }
        let clean = models.compactMap { m -> CustomModelInput? in
            let mid = m.id.trimmingCharacters(in: .whitespaces)
            if mid.isEmpty {
                return nil
            }
            var display = m.name.trimmingCharacters(in: .whitespaces)
            if display.isEmpty {
                display = mid
            }
            return CustomModelInput(id: mid, name: display, tools: m.tools)
        }
        if clean.isEmpty {
            toasts.error("At least one model required.")
            return
        }
        var seen = Set<String>()
        for m in clean {
            if seen.contains(m.id) {
                toasts.error("Duplicate model id: \(m.id)")
                return
            }
            seen.insert(m.id)
        }
        saving = true
        var key: String?
        let trimmedKey = apiKey.trimmingCharacters(in: .whitespaces)
        if !trimmedKey.isEmpty {
            key = trimmedKey
        }
        do {
            try await OpencodeAPI.addCustomProvider(CustomProviderInput(id: id, name: name, baseURL: baseURL, models: clean, apiKey: key, headers: nil))
            toasts.success("\(name) added.")
            onSaved()
            dismiss()
        } catch {
            toasts.error(error.localizedDescription)
        }
        saving = false
    }
}

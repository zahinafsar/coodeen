import SwiftUI

struct ModelPicker: View {
    @Environment(Workspace.self) private var workspace
    @Environment(\.openSettings) private var openSettings

    @State private var open = false
    @State private var providers: [ProviderItem] = []
    @State private var query = ""

    var body: some View {
        Button {
            open.toggle()
        } label: {
            HStack(spacing: 6) {
                Image(systemName: "cpu")
                    .font(.system(size: 11))
                Text(triggerLabel)
                    .lineLimit(1)
                    .truncationMode(.tail)
                    .frame(maxWidth: 240, alignment: .leading)
            }
        }
        .buttonStyle(OutlineButtonStyle(height: 28))
        .popover(isPresented: $open, arrowEdge: .bottom) {
            popoverContent
        }
        .onChange(of: open) { _, isOpen in
            if isOpen {
                Task {
                    providers = (try? await OpencodeAPI.listProviders()) ?? []
                }
            } else {
                query = ""
            }
        }
        .task {
            if providers.isEmpty {
                providers = (try? await OpencodeAPI.listProviders()) ?? []
            }
        }
    }

    private var triggerLabel: String {
        guard let model = workspace.model else {
            return "Pick model"
        }
        let providerName = providers.first { $0.id == model.providerId }?.name
        return "\(ProviderCatalog.displayName(model.providerId, fallback: providerName)) · \(model.modelId)"
    }

    private var usable: [ProviderItem] {
        providers.filter(\.isUsable)
    }

    private var filtered: [(ProviderItem, [ProviderModelItem])] {
        let q = query.trimmingCharacters(in: .whitespaces).lowercased()
        return usable.compactMap { provider in
            let models = provider.models.filter { m in
                if q.isEmpty {
                    return true
                }
                return m.id.lowercased().contains(q)
                    || m.name.lowercased().contains(q)
                    || ProviderCatalog.displayName(provider.id, fallback: provider.name).lowercased().contains(q)
            }
            if models.isEmpty {
                return nil
            }
            return (provider, models)
        }
    }

    private var popoverContent: some View {
        VStack(spacing: 0) {
            HStack(spacing: 6) {
                Image(systemName: "magnifyingglass")
                    .font(.system(size: 12))
                    .foregroundStyle(Palette.mutedForeground)
                TextField("Search models", text: $query)
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
            .padding(.horizontal, 12)
            .frame(height: 36)
            .cardBorder(.bottom)

            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    if usable.isEmpty {
                        emptyText("No providers connected.")
                    } else if filtered.isEmpty {
                        emptyText("No models match \u{201C}\(query)\u{201D}.")
                    } else {
                        ForEach(filtered, id: \.0.id) { provider, models in
                            Text(ProviderCatalog.displayName(provider.id, fallback: provider.name).uppercased())
                                .font(.system(size: 10))
                                .tracking(0.8)
                                .foregroundStyle(Palette.mutedForeground)
                                .padding(.horizontal, 8)
                                .padding(.vertical, 6)
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .cardBorder([.top, .bottom])
                                .padding(.vertical, 4)
                            ForEach(models) { model in
                                ModelRow(
                                    model: model,
                                    active: workspace.model?.providerId == provider.id && workspace.model?.modelId == model.id
                                ) {
                                    workspace.setModel(SessionModel(providerId: provider.id, modelId: model.id))
                                    open = false
                                }
                            }
                        }
                    }
                }
                .padding(4)
            }
            .frame(maxHeight: 340)

            Button {
                open = false
                openSettings()
            } label: {
                HStack(spacing: 6) {
                    Image(systemName: "gearshape")
                        .font(.system(size: 11))
                    Text("Manage providers")
                        .font(.system(size: 12))
                    Spacer()
                }
                .frame(maxWidth: .infinity)
            }
            .buttonStyle(HoverButtonStyle(padding: 8))
            .padding(4)
            .cardBorder(.top)
        }
        .frame(width: 360)
        .background(Palette.background)
    }

    private func emptyText(_ text: String) -> some View {
        Text(text)
            .font(.system(size: 12))
            .foregroundStyle(Palette.mutedForeground)
            .frame(maxWidth: .infinity)
            .padding(24)
    }
}

private struct ModelRow: View {
    let model: ProviderModelItem
    let active: Bool
    let action: () -> Void
    @State private var hovering = false

    var body: some View {
        Button(action: action) {
            HStack(spacing: 8) {
                HStack(alignment: .firstTextBaseline, spacing: 8) {
                    Text(model.name.isEmpty ? model.id : model.name)
                        .font(.system(size: 13))
                        .lineLimit(1)
                    if !model.name.isEmpty && model.name != model.id {
                        Text(model.id)
                            .font(.system(size: 10, design: .monospaced))
                            .foregroundStyle(Palette.mutedForeground)
                            .lineLimit(1)
                    }
                }
                Spacer()
                if active {
                    Image(systemName: "checkmark")
                        .font(.system(size: 11))
                        .foregroundStyle(Palette.primary)
                }
            }
            .padding(.horizontal, 8)
            .padding(.vertical, 6)
            .background(RoundedRectangle(cornerRadius: Palette.radiusSm).fill(active || hovering ? Palette.accent : Color.clear))
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .foregroundStyle(Palette.foreground)
        .onHover { hovering = $0 }
    }
}

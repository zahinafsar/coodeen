import SwiftUI

struct SettingsView: View {
    @Environment(ToastCenter.self) private var toasts

    @State private var providers: [ProviderItem] = []
    @State private var loading = true
    @State private var catalogOpen = false
    @State private var keyEntry: CatalogEntry?
    @State private var customOpen = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                Text("Settings")
                    .font(.system(size: 20, weight: .semibold))

                VStack(alignment: .leading, spacing: 6) {
                    Text("Providers")
                        .font(.system(size: 15, weight: .semibold))
                    Text("Connect AI providers to start chatting. Each provider needs its own API key.")
                        .font(.system(size: 12))
                        .foregroundStyle(Palette.mutedForeground)

                    VStack(spacing: 0) {
                        if loading {
                            HStack(spacing: 8) {
                                SpinnerView(size: 12)
                                Text("Loading...")
                            }
                            .font(.system(size: 12))
                            .foregroundStyle(Palette.mutedForeground)
                            .frame(maxWidth: .infinity, minHeight: 80)
                        } else {
                            if connected.isEmpty {
                                Text("No providers connected yet.")
                                    .font(.system(size: 12))
                                    .foregroundStyle(Palette.mutedForeground)
                                    .frame(maxWidth: .infinity, alignment: .leading)
                                    .padding(.vertical, 12)
                            } else {
                                ForEach(connected) { provider in
                                    ConnectedProviderRow(provider: provider, onChanged: reload)
                                }
                            }
                            HStack {
                                Button {
                                    catalogOpen = true
                                } label: {
                                    HStack(spacing: 6) {
                                        Image(systemName: "plus")
                                            .font(.system(size: 11))
                                        Text("Add provider")
                                    }
                                }
                                .buttonStyle(OutlineButtonStyle(height: 30))
                                Spacer()
                            }
                            .padding(.top, 10)
                        }
                    }
                    .padding(.top, 12)
                }
                .padding(20)
                .background(RoundedRectangle(cornerRadius: Palette.radius + 4).fill(Palette.card))
                .overlay(RoundedRectangle(cornerRadius: Palette.radius + 4).stroke(Palette.border, lineWidth: 1))
            }
            .padding(.horizontal, 24)
            .padding(.vertical, 32)
            .frame(maxWidth: 672)
            .frame(maxWidth: .infinity)
        }
        .background(Palette.background)
        .foregroundStyle(Palette.foreground)
        .overlay(alignment: .bottomTrailing) {
            ToastOverlay()
                .padding(16)
        }
        .task {
            await load()
        }
        .sheet(isPresented: $catalogOpen) {
            ConnectProviderSheet(
                connectedIds: Set(connected.map(\.id)),
                onSelectProvider: { entry in
                    catalogOpen = false
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
                        keyEntry = entry
                    }
                },
                onSelectCustom: {
                    catalogOpen = false
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
                        customOpen = true
                    }
                }
            )
        }
        .sheet(item: $keyEntry) { entry in
            ConnectKeySheet(
                entry: entry,
                onBack: {
                    keyEntry = nil
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
                        catalogOpen = true
                    }
                },
                onConnected: reload
            )
        }
        .sheet(isPresented: $customOpen) {
            CustomProviderSheet(onSaved: reload)
        }
    }

    private var connected: [ProviderItem] {
        providers.filter(\.isConnected)
    }

    private func reload() {
        Task {
            await load()
        }
    }

    private func load() async {
        do {
            providers = try await OpencodeAPI.listProviders()
        } catch {
            providers = []
        }
        loading = false
    }
}

private struct ConnectedProviderRow: View {
    let provider: ProviderItem
    let onChanged: () -> Void

    @Environment(ToastCenter.self) private var toasts
    @State private var deleting = false

    private var isCustom: Bool {
        provider.source == "config"
    }

    private var name: String {
        ProviderCatalog.displayName(provider.id, fallback: provider.name)
    }

    private var subtitle: String {
        if isCustom {
            let ids = provider.models.map(\.id).joined(separator: ", ")
            if ids.isEmpty {
                return "no models"
            }
            return ids
        }
        if let note = ProviderCatalog.popular.first(where: { $0.id == provider.id })?.note {
            return note
        }
        if provider.models.count == 1 {
            return "1 model"
        }
        return "\(provider.models.count) models"
    }

    var body: some View {
        HStack(spacing: 12) {
            ProviderAvatar(id: provider.id, name: name)
            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 8) {
                    Text(name)
                        .font(.system(size: 13, weight: .medium))
                    BadgeView(text: isCustom ? "Custom" : "Connected", outline: isCustom)
                }
                Text(subtitle)
                    .font(.system(size: 11))
                    .foregroundStyle(Palette.mutedForeground)
                    .lineLimit(1)
            }
            Spacer()
            Button {
                Task {
                    await disconnect()
                }
            } label: {
                if deleting {
                    SpinnerView(size: 12)
                        .frame(width: 16, height: 16)
                } else {
                    Image(systemName: "trash")
                        .font(.system(size: 12))
                        .frame(width: 16, height: 16)
                }
            }
            .buttonStyle(HoverButtonStyle(padding: 8))
            .disabled(deleting)
            .help("Disconnect")
        }
        .padding(.vertical, 8)
        .cardBorder(.bottom)
    }

    private func disconnect() async {
        deleting = true
        do {
            if isCustom {
                try await OpencodeAPI.removeCustomProvider(provider.id)
            } else {
                try await OpencodeAPI.deleteApiKey(providerId: provider.id)
            }
            toasts.success("\(name) disconnected.")
            onChanged()
        } catch {
            toasts.error(error.localizedDescription)
        }
        deleting = false
    }
}

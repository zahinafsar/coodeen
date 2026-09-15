import Foundation
import Observation

struct Toast: Identifiable, Hashable {
    enum Kind {
        case success
        case error
        case info
    }

    let id = UUID()
    let kind: Kind
    let message: String
}

@MainActor
@Observable
final class ToastCenter {
    private(set) var toasts: [Toast] = []

    func success(_ message: String) {
        push(Toast(kind: .success, message: message))
    }

    func error(_ message: String) {
        push(Toast(kind: .error, message: message))
    }

    func info(_ message: String) {
        push(Toast(kind: .info, message: message))
    }

    func dismiss(_ id: UUID) {
        toasts.removeAll { $0.id == id }
    }

    private func push(_ toast: Toast) {
        toasts.append(toast)
        if toasts.count > 4 {
            toasts.removeFirst(toasts.count - 4)
        }
        let id = toast.id
        Task { @MainActor [weak self] in
            try? await Task.sleep(nanoseconds: 4_000_000_000)
            self?.dismiss(id)
        }
    }
}

import Foundation
import Observation

struct OpencodeEvent {
    let type: String
    let properties: JSONValue
}

@MainActor
@Observable
final class EventBus {
    private(set) var connected = false

    @ObservationIgnored private var loopTask: Task<Void, Never>?
    @ObservationIgnored private var streamTask: Task<Void, Error>?
    @ObservationIgnored private var listeners: [UUID: (OpencodeEvent) -> Void] = [:]

    private let heartbeat: TimeInterval = 15
    private let reconnectMin: TimeInterval = 0.5
    private let reconnectMax: TimeInterval = 5

    func start() {
        if loopTask != nil {
            return
        }
        loopTask = Task { [weak self] in
            await self?.runLoop()
        }
    }

    func stop() {
        loopTask?.cancel()
        streamTask?.cancel()
        loopTask = nil
        streamTask = nil
        connected = false
    }

    func reconnect() {
        streamTask?.cancel()
    }

    @discardableResult
    func subscribe(_ handler: @escaping (OpencodeEvent) -> Void) -> UUID {
        let id = UUID()
        listeners[id] = handler
        return id
    }

    func unsubscribe(_ id: UUID) {
        listeners.removeValue(forKey: id)
    }

    private func dispatch(_ event: OpencodeEvent) {
        for handler in listeners.values {
            handler(event)
        }
    }

    private func runLoop() async {
        var attempt = 0
        while !Task.isCancelled {
            do {
                let base = try await OpencodeSidecar.shared.start()
                let task = Task<Void, Error> { [weak self] in
                    try await self?.runStream(base: base)
                }
                streamTask = task
                _ = try? await task.value
                attempt = 0
            } catch {
            }
            connected = false
            if Task.isCancelled {
                break
            }
            let delay = min(reconnectMax, reconnectMin * pow(2, Double(attempt)))
            attempt = min(attempt + 1, 6)
            try? await Task.sleep(nanoseconds: UInt64(delay * 1_000_000_000))
        }
    }

    private nonisolated func runStream(base: URL) async throws {
        var request = URLRequest(url: base.appendingPathComponent("global/event"))
        request.setValue("text/event-stream", forHTTPHeaderField: "Accept")
        request.timeoutInterval = .infinity
        let (bytes, response) = try await OpencodeClient.shared.session.bytes(for: request)
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        if !(200..<300).contains(status) {
            throw APIError(message: "event stream \(status)")
        }
        await MainActor.run {
            self.connected = true
        }

        let watchdog = HeartbeatWatchdog(interval: heartbeat)
        let streamTask = await MainActor.run { self.streamTask }
        watchdog.onExpire = {
            streamTask?.cancel()
        }
        watchdog.reset()
        defer {
            watchdog.invalidate()
        }

        var dataBuffer = ""
        for try await line in bytes.lines {
            if Task.isCancelled {
                break
            }
            watchdog.reset()
            if line.hasPrefix("data:") {
                var payload = String(line.dropFirst(5))
                if payload.hasPrefix(" ") {
                    payload.removeFirst()
                }
                if !dataBuffer.isEmpty {
                    dataBuffer += "\n"
                }
                dataBuffer += payload
                if let event = Self.decode(dataBuffer) {
                    dataBuffer = ""
                    await MainActor.run {
                        self.dispatch(event)
                    }
                }
            } else if line.isEmpty {
                if let event = Self.decode(dataBuffer) {
                    await MainActor.run {
                        self.dispatch(event)
                    }
                }
                dataBuffer = ""
            }
        }
    }

    private nonisolated static func decode(_ text: String) -> OpencodeEvent? {
        guard !text.isEmpty, let raw = JSONValue.parse(Data(text.utf8)) else {
            return nil
        }
        let payload = raw["payload"] ?? raw
        guard let type = payload["type"]?.stringValue else {
            return nil
        }
        return OpencodeEvent(type: type, properties: payload["properties"] ?? .object([:]))
    }
}

final class HeartbeatWatchdog: @unchecked Sendable {
    private let interval: TimeInterval
    private let queue = DispatchQueue(label: "com.coodeen.heartbeat")
    private var workItem: DispatchWorkItem?
    var onExpire: (() -> Void)?

    init(interval: TimeInterval) {
        self.interval = interval
    }

    func reset() {
        queue.async {
            self.workItem?.cancel()
            let item = DispatchWorkItem { [weak self] in
                self?.onExpire?()
            }
            self.workItem = item
            self.queue.asyncAfter(deadline: .now() + self.interval, execute: item)
        }
    }

    func invalidate() {
        queue.async {
            self.workItem?.cancel()
            self.workItem = nil
            self.onExpire = nil
        }
    }
}

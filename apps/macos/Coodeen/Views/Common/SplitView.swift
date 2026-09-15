import SwiftUI
import AppKit

struct SplitView<First: View, Second: View>: View {
    enum Axis {
        case horizontal
        case vertical
    }

    let axis: Axis
    @Binding var fraction: CGFloat
    var minFirst: CGFloat = 120
    var minSecond: CGFloat = 120
    var secondCollapsed = false
    @ViewBuilder let first: () -> First
    @ViewBuilder let second: () -> Second

    @State private var dragStart: CGFloat?

    var body: some View {
        GeometryReader { geo in
            let total = totalLength(geo.size)
            let firstLength = clampedLength(total)
            if axis == .horizontal {
                HStack(spacing: 0) {
                    first()
                        .frame(width: secondCollapsed ? geo.size.width : firstLength)
                    if !secondCollapsed {
                        divider(total: total, current: firstLength)
                        second()
                            .frame(width: max(0, total - firstLength - 1))
                    }
                }
            } else {
                VStack(spacing: 0) {
                    first()
                        .frame(height: secondCollapsed ? geo.size.height : firstLength)
                    if !secondCollapsed {
                        divider(total: total, current: firstLength)
                        second()
                            .frame(height: max(0, total - firstLength - 1))
                    }
                }
            }
        }
    }

    private func totalLength(_ size: CGSize) -> CGFloat {
        if axis == .horizontal {
            return size.width
        }
        return size.height
    }

    private func clampedLength(_ total: CGFloat) -> CGFloat {
        let available = max(0, total - 1)
        let proposed = available * fraction
        let upper = max(minFirst, available - minSecond)
        return min(max(proposed, minFirst), upper)
    }

    @ViewBuilder
    private func divider(total: CGFloat, current: CGFloat) -> some View {
        let isHorizontal = axis == .horizontal
        Rectangle()
            .fill(Palette.border)
            .frame(width: isHorizontal ? 1 : nil, height: isHorizontal ? nil : 1)
            .overlay(
                Color.clear
                    .frame(width: isHorizontal ? 9 : nil, height: isHorizontal ? nil : 9)
                    .contentShape(Rectangle())
                    .onHover { inside in
                        if inside {
                            if isHorizontal {
                                NSCursor.resizeLeftRight.push()
                            } else {
                                NSCursor.resizeUpDown.push()
                            }
                        } else {
                            NSCursor.pop()
                        }
                    }
                    .gesture(
                        DragGesture(minimumDistance: 1, coordinateSpace: .global)
                            .onChanged { value in
                                if dragStart == nil {
                                    dragStart = current
                                }
                                let delta: CGFloat
                                if isHorizontal {
                                    delta = value.translation.width
                                } else {
                                    delta = value.translation.height
                                }
                                let available = max(1, total - 1)
                                let next = (dragStart ?? current) + delta
                                let clamped = min(max(next, minFirst), max(minFirst, available - minSecond))
                                fraction = clamped / available
                            }
                            .onEnded { _ in
                                dragStart = nil
                            }
                    )
            )
            .zIndex(1)
    }
}

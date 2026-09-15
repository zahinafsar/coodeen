import Foundation
import WebKit
import AppKit

struct PickedElement {
    let tag: String
    let id: String
    let classes: [String]
    let text: String
    let html: String
    let selector: String
    let rect: CGRect
}

enum ElementPickerScript {
    static let handlerName = "coodeenPicker"

    static let install = """
    (function() {
      if (window.__coodeenPicker) { window.__coodeenPicker.enable(); return; }
      var HL = '__coodeen_hl__', TT = '__coodeen_tt__';
      var active = false, last = null;
      function ensure() {
        if (!document.body) return;
        if (!document.getElementById(HL)) {
          var hl = document.createElement('div');
          hl.id = HL;
          hl.style.cssText = 'position:fixed;pointer-events:none;z-index:2147483647;border:2px solid #3b82f6;background:rgba(59,130,246,0.1);transition:all 50ms;display:none;';
          document.body.appendChild(hl);
          var tt = document.createElement('div');
          tt.id = TT;
          tt.style.cssText = 'position:fixed;pointer-events:none;z-index:2147483647;background:#1e1e2e;color:#cdd6f4;font:11px monospace;padding:3px 8px;border-radius:4px;white-space:nowrap;display:none;';
          document.body.appendChild(tt);
        }
      }
      function remove() {
        var a = document.getElementById(HL); if (a) a.remove();
        var b = document.getElementById(TT); if (b) b.remove();
      }
      function describe(el) {
        var tag = el.tagName.toLowerCase();
        var id = el.id ? '#' + el.id : '';
        var cls = (el.className && typeof el.className === 'string') ? '.' + el.className.trim().split(/\\s+/).join('.') : '';
        return tag + id + cls;
      }
      function selector(el) {
        if (el.id) return '#' + el.id;
        var tag = el.tagName.toLowerCase();
        var cls = Array.prototype.join.call(el.classList, '.');
        return cls ? tag + '.' + cls : tag;
      }
      function highlight(el) {
        ensure();
        var hl = document.getElementById(HL), tt = document.getElementById(TT);
        if (!hl || !tt) return;
        var r = el.getBoundingClientRect();
        hl.style.left = r.left + 'px'; hl.style.top = r.top + 'px';
        hl.style.width = r.width + 'px'; hl.style.height = r.height + 'px';
        hl.style.display = 'block';
        tt.textContent = describe(el);
        tt.style.left = r.left + 'px'; tt.style.top = Math.max(0, r.top - 22) + 'px';
        tt.style.display = 'block';
      }
      function onMove(e) {
        if (!active) return;
        var el = document.elementFromPoint(e.clientX, e.clientY);
        if (!el || el.id === HL || el.id === TT) return;
        last = el;
        highlight(el);
      }
      function block(e) {
        if (!active) return;
        e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
      }
      function onClick(e) {
        if (!active) return;
        e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
        var el = last || document.elementFromPoint(e.clientX, e.clientY);
        if (!el) return;
        var hl = document.getElementById(HL), tt = document.getElementById(TT);
        if (hl) hl.style.display = 'none';
        if (tt) tt.style.display = 'none';
        var r = el.getBoundingClientRect();
        var payload = {
          type: 'picked',
          tag: el.tagName.toLowerCase(),
          id: el.id || '',
          classes: (el.className && typeof el.className === 'string') ? el.className.trim().split(/\\s+/).filter(Boolean) : [],
          text: (el.textContent || '').trim().slice(0, 200),
          html: (el.outerHTML || '').slice(0, 500),
          selector: selector(el),
          x: r.left, y: r.top, width: r.width, height: r.height
        };
        requestAnimationFrame(function() { requestAnimationFrame(function() {
          window.webkit.messageHandlers.\(handlerName).postMessage(payload);
        }); });
      }
      function onKey(e) {
        if (active && e.key === 'Escape') {
          window.webkit.messageHandlers.\(handlerName).postMessage({ type: 'cancel' });
        }
      }
      document.addEventListener('mousemove', onMove, true);
      document.addEventListener('mousedown', block, true);
      document.addEventListener('mouseup', block, true);
      document.addEventListener('click', onClick, true);
      document.addEventListener('keydown', onKey, true);
      window.__coodeenPicker = {
        enable: function() { active = true; ensure(); document.documentElement.style.cursor = 'crosshair'; },
        disable: function() { active = false; last = null; remove(); document.documentElement.style.cursor = ''; }
      };
      window.__coodeenPicker.enable();
    })();
    """

    static let disable = "if (window.__coodeenPicker) { window.__coodeenPicker.disable(); }"

    static func parse(_ body: Any) -> PickedElement? {
        guard let dict = body as? [String: Any], dict["type"] as? String == "picked" else {
            return nil
        }
        func num(_ key: String) -> CGFloat {
            CGFloat((dict[key] as? NSNumber)?.doubleValue ?? 0)
        }
        return PickedElement(
            tag: dict["tag"] as? String ?? "",
            id: dict["id"] as? String ?? "",
            classes: dict["classes"] as? [String] ?? [],
            text: dict["text"] as? String ?? "",
            html: dict["html"] as? String ?? "",
            selector: dict["selector"] as? String ?? "",
            rect: CGRect(x: num("x"), y: num("y"), width: num("width"), height: num("height"))
        )
    }

    static func isCancel(_ body: Any) -> Bool {
        (body as? [String: Any])?["type"] as? String == "cancel"
    }
}

enum WebSnapshot {
    @MainActor
    static func capture(_ webView: WKWebView, cssRect: CGRect, padding: CGFloat = 4) async -> String? {
        let zoom = webView.pageZoom
        let rect = CGRect(
            x: (cssRect.minX - padding) * zoom,
            y: (cssRect.minY - padding) * zoom,
            width: (cssRect.width + padding * 2) * zoom,
            height: (cssRect.height + padding * 2) * zoom
        ).intersection(webView.bounds)
        if rect.isEmpty {
            return nil
        }
        let config = WKSnapshotConfiguration()
        config.rect = rect
        do {
            let image = try await webView.takeSnapshot(configuration: config)
            return ImageUtils.pngDataURL(from: image)
        } catch {
            return nil
        }
    }
}

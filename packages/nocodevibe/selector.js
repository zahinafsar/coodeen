(function () {
  const overlay = document.createElement("div");
  Object.assign(overlay.style, {
    position: "fixed",
    pointerEvents: "none",
    zIndex: "2147483647",
    border: "2px solid #3b82f6",
    background: "rgba(59,130,246,0.08)",
    borderRadius: "4px",
    transition: "all 0.05s ease",
    display: "none",
  });
  document.body.appendChild(overlay);

  const label = document.createElement("div");
  Object.assign(label.style, {
    position: "fixed",
    pointerEvents: "none",
    zIndex: "2147483647",
    background: "#3b82f6",
    color: "#fff",
    fontSize: "11px",
    fontFamily: "monospace",
    padding: "2px 6px",
    borderRadius: "3px",
    display: "none",
    whiteSpace: "nowrap",
  });
  document.body.appendChild(label);

  document.addEventListener(
    "mousemove",
    (e) => {
      const el = document.elementFromPoint(e.clientX, e.clientY);
      if (!el || el === document.body || el === document.documentElement) {
        overlay.style.display = "none";
        label.style.display = "none";
        return;
      }
      const r = el.getBoundingClientRect();
      Object.assign(overlay.style, {
        display: "block",
        top: r.top + "px",
        left: r.left + "px",
        width: r.width + "px",
        height: r.height + "px",
      });
      label.textContent =
        el.tagName.toLowerCase() +
        (el.id ? "#" + el.id : "") +
        (el.className && typeof el.className === "string"
          ? "." + el.className.trim().split(/\s+/).join(".")
          : "");
      Object.assign(label.style, {
        display: "block",
        top: Math.max(0, r.top - 22) + "px",
        left: r.left + "px",
      });
    },
    true
  );

  document.addEventListener(
    "click",
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      const el = document.elementFromPoint(e.clientX, e.clientY);
      if (!el || el === overlay || el === label) return;

      const tag = el.tagName.toLowerCase();
      let attrs = "";
      for (const a of el.attributes) {
        let val = a.value;
        if (val.length > 80) val = val.slice(0, 80) + "...";
        attrs += " " + a.name + '="' + val.replace(/"/g, "&quot;") + '"';
      }
      let inner =
        el.children.length > 0
          ? "..."
          : (el.textContent || "").trim();
      if (inner.length > 80) inner = inner.slice(0, 80) + "...";
      const html = "<" + tag + attrs + ">" + inner + "</" + tag + ">";

      const cls =
        typeof el.className === "string" ? el.className : "";
      const elId = el.id || "";
      const text =
        el.children.length === 0
          ? (el.textContent || "").trim().slice(0, 100)
          : "";
      const elStyle = el.getAttribute("style") || "";

      // Walk React fiber tree to find nearest component name
      let componentName = "";
      const fiberKey = Object.keys(el).find((k) =>
        k.startsWith("__reactFiber$")
      );
      if (fiberKey) {
        let fiber = el[fiberKey];
        while (fiber) {
          if (typeof fiber.type === "function") {
            componentName =
              fiber.type.displayName || fiber.type.name || "";
            if (componentName) break;
          }
          fiber = fiber.return;
        }
      }

      window.parent.postMessage(
        {
          type: "element-selected",
          html,
          tag,
          className: cls,
          id: elId,
          textContent: text,
          style: elStyle,
          componentName,
        },
        "*"
      );
    },
    true
  );

  document.addEventListener(
    "keydown",
    (e) => {
      if (e.key === "Escape") {
        window.parent.postMessage({ type: "selector-cancel" }, "*");
      }
    },
    true
  );
})();

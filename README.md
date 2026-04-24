<p align="center">
  <img src="https://raw.githubusercontent.com/zahinafsar/coodeen/main/apps/desktop/public/logo.svg" alt="Coodeen" width="400" />
</p>

<p align="center">
  <strong>AI coding assistant with a split-pane editor — chat on the left, preview / files / git / terminal on the right.</strong>
</p>

<p align="center">
  <a href="https://github.com/zahinafsar/coodeen/releases/latest"><img src="https://img.shields.io/github/v/release/zahinafsar/coodeen" alt="latest release" /></a>
  <a href="https://github.com/zahinafsar/coodeen/releases"><img src="https://img.shields.io/github/downloads/zahinafsar/coodeen/total" alt="downloads" /></a>
</p>

---

## Download

The landing page currently ships a macOS (Apple Silicon) build only:

| Platform | Download |
|----------|----------|
| macOS (Apple Silicon) | [Coodeen-mac-arm64.dmg](https://github.com/zahinafsar/coodeen/releases/latest/download/Coodeen-mac-arm64.dmg) |

Other architectures / platforms may appear in the [releases](https://github.com/zahinafsar/coodeen/releases) feed as they're cut by CI.

After installing on macOS, clear the quarantine xattr so Gatekeeper lets the app run:

```bash
xattr -cr /Applications/Coodeen.app
```

## Features

- **Chat with your codebase** — Ask the AI to build, edit, explain, or debug. The agent runs tool calls (read, write, grep, bash, etc.) inline in the chat.
- **Live preview** — Embedded browser pointed at your dev server. Default URL is `http://localhost:3000`; editable per session.
- **Element selection → screenshot** — Click an element in the preview to capture it and attach it to your next prompt.
- **File explorer** — Browse, view, create, and delete files in the project directory.
- **Git panel** — Branches, status, diffs, conflicts, commit, push, pull, merge.
- **Built-in terminal** — node-pty shell, togglable under the preview.
- **Sessions** — Persistent sessions, each with its own project directory and preview URL. Drawer in the top-left toggles the list.
- **Custom action buttons** — Drop a `coodeen.json` in your project and buttons show up in the top bar to run shell scripts scoped to the project.
- **Fully local** — API keys and sessions live on your machine.

## Model Setup

The current UI has a single **OpenAI** key dialog (key icon in the top bar). API keys are written to opencode's auth store (`~/.local/share/opencode/auth.json`). The model used for prompts is currently fixed by the app; the "Agent" badge in the composer shows what's in use.

The underlying sidecar is [`opencode`](https://github.com/sst/opencode), which supports more providers — but the Coodeen UI doesn't yet expose that surface.

## How It Works

Coodeen is an Electron shell around the `opencode` agent. On launch the main process spawns `opencode serve --hostname=127.0.0.1 --port=0` as a child and connects to it through `@opencode-ai/sdk`. The renderer (React) drives the split-pane UI; Electron main handles filesystem, git, terminal (node-pty), and opencode RPC.

- **Agent, sessions, tool execution, provider auth** — opencode sidecar (local HTTP)
- **Event stream** — `/global/event` SSE from the sidecar, fanned out to the renderer over IPC
- **Filesystem / git / terminal** — Electron main-process handlers
- **UI** — React + Tailwind + Radix in the Electron renderer

## Architecture

```
coodeen/
├── apps/
│   ├── desktop/              # Electron app
│   │   ├── src/
│   │   │   ├── main.ts       # Electron main process
│   │   │   ├── preload.ts    # IPC bridge (context isolation)
│   │   │   ├── handlers/     # opencode, sessions, chat, fs, git, pty,
│   │   │   │                 # providers, config, actions
│   │   │   └── renderer/     # React UI (chat, preview, files, git, terminal)
│   │   ├── resources/bin/    # opencode binary (fetched at build time)
│   │   └── electron-builder.yml
│   └── docs/                 # Docs site (Next.js + Fumadocs)
└── scripts/
    ├── fetch-opencode.js     # Download platform-matched opencode binary
    ├── copy-modules.js       # Copy prod deps for packaging
    └── rebuild-native.js     # Rebuild native modules for Electron
```

## Development

```bash
# Install deps + rebuild native modules for Electron
bun run setup

# Dev mode (auto-fetches opencode binary on first build)
bun run dev

# Type check
bun run --cwd apps/desktop typecheck

# Unpacked build
bun run build

# Build + package installers for the current platform
bun run --cwd apps/desktop build:prod

# Docs site (Next.js)
bun run dev:docs
```

Pin a specific opencode version:

```bash
OPENCODE_VERSION=0.x.y bun run --cwd apps/desktop fetch-opencode
```

The downloaded version is tracked in `apps/desktop/resources/bin/.opencode-version`.

## Data Storage

| What | Where |
|------|-------|
| Sessions, messages, tool history | opencode — `~/.local/share/opencode/` |
| Provider API keys | opencode — `~/.local/share/opencode/auth.json` |
| Per-session preview URL | Electron userData — `session-prefs.json` |
| Active provider selection | Electron userData — `app-config.json` |

Electron userData paths:

| Platform | Path |
|----------|------|
| macOS | `~/Library/Application Support/coodeen/` |
| Windows | `%APPDATA%/coodeen/` |
| Linux | `~/.config/coodeen/` |

No data is sent off-machine except requests to the provider endpoint.

## `coodeen.json`

Optional per-project file read by the main process (`handlers/actions.ts`). Example:

```json
{
  "name": "my-app",
  "actions": [
    { "label": "Dev", "script": "bun run dev" },
    { "label": "Test", "script": "bun run test" }
  ]
}
```

Each `actions` entry renders as a button in the top bar and runs the `script` via `sh -c` in the project directory. A `.env` next to it is loaded into the child's environment.

## Troubleshooting

**Sidecar won't start** — Check that `apps/desktop/resources/bin/opencode` exists in dev or `<app>/Contents/Resources/bin/opencode` in the packaged app. Re-run `bun run --cwd apps/desktop fetch-opencode`.

**macOS "damaged app" / Gatekeeper warning** — Run `xattr -cr /Applications/Coodeen.app` (the app isn't yet code-signed).

**Fresh start** — Delete the Electron userData folder *and* `~/.local/share/opencode/`.

## License

MIT

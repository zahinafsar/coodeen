<p align="center">
  <img src="https://raw.githubusercontent.com/zahinafsar/coodeen/main/apps/docs/public/logo.svg" alt="Coodeen" width="400" />
</p>

<p align="center">
  <strong>AI coding assistant with a split-pane editor — chat on the left, live preview on the right.</strong>
</p>

<p align="center">
  <a href="https://github.com/zahinafsar/coodeen/releases/latest"><img src="https://img.shields.io/github/v/release/zahinafsar/coodeen" alt="latest release" /></a>
  <a href="https://github.com/zahinafsar/coodeen/releases"><img src="https://img.shields.io/github/downloads/zahinafsar/coodeen/total" alt="downloads" /></a>
  <a href="https://github.com/zahinafsar/coodeen/blob/main/LICENSE"><img src="https://img.shields.io/github/license/zahinafsar/coodeen" alt="license" /></a>
</p>

---

## Download

Download the latest release for your platform:

| Platform | Download |
|----------|----------|
| macOS (Apple Silicon) | [Coodeen-mac-arm64.dmg](https://github.com/zahinafsar/coodeen/releases/latest/download/Coodeen-mac-arm64.dmg) |
| macOS (Intel) | [Coodeen-mac-x64.dmg](https://github.com/zahinafsar/coodeen/releases/latest/download/Coodeen-mac-x64.dmg) |
| Windows | [Coodeen-Setup.exe](https://github.com/zahinafsar/coodeen/releases/latest/download/Coodeen-Setup.exe) |
| Linux | [Coodeen-linux.AppImage](https://github.com/zahinafsar/coodeen/releases/latest/download/Coodeen-linux.AppImage) |

Or browse [all releases](https://github.com/zahinafsar/coodeen/releases).

## Features

- **Multi-model chat** — Talk to OpenAI, Anthropic, or Google models about your code
- **Live preview** — See your running app side-by-side with the conversation
- **Screenshot capture** — Select any area of the preview and send it to the AI
- **Built-in terminal** — Full shell access via integrated terminal
- **File explorer** — Browse and manage project files
- **Git integration** — View branches, status, and commit history
- **Session management** — Switch between projects and pick up where you left off
- **Fully local** — Your API keys, conversations, and data never leave your machine

## Getting Started

1. Download and install Coodeen for your platform
2. Launch the app
3. Open Settings (gear icon) and add an API key for at least one provider
4. Select a project directory using the folder picker
5. Point the preview panel to your dev server (e.g. `http://localhost:3000`)
6. Start chatting — ask the AI to build features, fix bugs, or explain code

## Setup

On first launch, Coodeen creates a local SQLite database to store your sessions, messages, and settings. Configure at least one AI provider:

| Provider | Get API Key | Models |
|----------|-------------|--------|
| OpenAI | [platform.openai.com](https://platform.openai.com/api-keys) | GPT-4o, GPT-4.1, GPT-4.1-mini |
| Anthropic | [console.anthropic.com](https://console.anthropic.com/) | Claude Sonnet 4, Claude Haiku |
| Google | [aistudio.google.com](https://aistudio.google.com/apikey) | Gemini 2.5 Pro, Gemini 2.5 Flash |

## How It Works

Coodeen is a split-pane desktop app — chat on the left, preview / files / git / terminal on the right. Everything runs locally on your machine:

- **Main process** — Electron with SQLite (Drizzle ORM), IPC handlers for filesystem, git, terminal, and AI
- **Renderer** — React app with resizable split-pane layout, Markdown rendering, syntax highlighting
- **AI agent** — Vercel AI SDK with tool calling for code read/write/edit/search/bash

## Architecture

```
coodeen/
├── apps/
│   ├── desktop/         # Electron desktop app
│   │   ├── src/
│   │   │   ├── main.ts        # Electron main process
│   │   │   ├── preload.ts     # IPC bridge (context isolation)
│   │   │   ├── handlers/      # IPC handlers (chat, fs, git, pty, etc.)
│   │   │   ├── tools/         # AI tools (read, write, edit, grep, bash, etc.)
│   │   │   ├── db/            # SQLite + Drizzle ORM
│   │   │   └── renderer/      # React frontend
│   │   └── electron-builder.yml
│   └── docs/            # Documentation site (Next.js + Fumadocs)
└── packages/
    └── cli/             # Legacy CLI package
```

## Development

```bash
# Install dependencies
bun install

# Run in development mode
bun run dev

# Type check
bun run --cwd apps/desktop typecheck

# Build for production
bun run build
```

## Data Storage

All data is stored locally in the platform-specific app data directory:

| Platform | Path |
|----------|------|
| macOS | `~/Library/Application Support/coodeen/coodeen.db` |
| Windows | `%APPDATA%/coodeen/coodeen.db` |
| Linux | `~/.config/coodeen/coodeen.db` |

No data is sent anywhere except to the AI provider you configure.

## Troubleshooting

**Database issues** — Delete the database file at the path above and relaunch Coodeen. A fresh database will be created automatically.

**AI can't see screenshots** — Make sure you're using a vision-capable model (GPT-4o, GPT-4.1, Claude Sonnet 4, Gemini 2.5 Pro).

## License

MIT

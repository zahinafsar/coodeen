# nocodevibe

A visual editor that sits beside your running React/Next.js app. Describe UI changes in plain english — Claude applies them to your codebase in real time.

## How it works

1. You run your dev server as usual
2. `nocodevibe` opens an editor UI with a live preview of your app
3. You describe changes (or click elements to reference them)
4. Claude edits your source files directly

## Quick start

```bash
npx nocodevibe
```

Then start your app on port `3000` and open `http://localhost:3001`.

## Usage

```bash
# defaults: target app on :3000, editor on :3001
npx nocodevibe

# custom target port
npx nocodevibe -p 4000

# custom both
npx nocodevibe -p 4000 -e 4001
```

| Flag | Description | Default |
|------|-------------|---------|
| `-p` | Port your app runs on | `3000` |
| `-e` | Port for the editor UI | `3001` |

## Features

- **Live preview** — proxied view of your running app inside the editor
- **Element selector** — click any element to reference it in your prompt
- **Source mapping** — clicked elements resolve to their file and line number
- **Session persistence** — conversation history saved to `.nocodevibe/session.json`
- **HMR passthrough** — Next.js hot reload works through the proxy

## Requirements

- Node.js 18+
- [Claude CLI](https://docs.anthropic.com/en/docs/claude-code) installed and authenticated

## License

MIT

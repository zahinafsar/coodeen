# Contributing to nocodevibe

Thanks for your interest in contributing! Here's how to get started.

## Setup

```bash
git clone https://github.com/zahinafsar/nocodevibe.git
cd nocodevibe
npm install
cd packages/nocodevibe && npm install
```

## Running locally

```bash
# start the demo Next.js app and editor together
sh dev.sh

# or start them separately
npm run dev          # Next.js on :3000
node packages/nocodevibe/cli.mjs   # editor on :3001
```

## Project layout

| Path | Description |
|------|-------------|
| `packages/nocodevibe/` | The npm package (CLI + server + UI) |
| `packages/nocodevibe/cli.mjs` | CLI entry point, parses flags |
| `packages/nocodevibe/server.mjs` | HTTP server, WebSocket, proxy, source finder |
| `packages/nocodevibe/index.html` | Editor UI (single-file, no build step) |
| `packages/nocodevibe/selector.js` | Element picker injected into the preview iframe |
| `app/` | Demo Next.js app for testing |
| `dev.sh` | Starts both the demo app and editor |

## Making changes

1. Fork the repo and create a branch from `main`
2. Make your changes in `packages/nocodevibe/`
3. Test locally with `sh dev.sh`
4. Open a pull request

## Guidelines

- No build step — the package ships raw `.mjs`, `.html`, and `.js` files
- Zero dependencies beyond `ws` (WebSocket server)
- Keep the editor UI as a single HTML file
- Test with both `node packages/nocodevibe/cli.mjs` and `npx .` from the package directory

## Reporting issues

Open an issue with:
- What you expected to happen
- What actually happened
- Node.js version (`node -v`)
- OS

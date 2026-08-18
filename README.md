# Kiro Code

A custom desktop interface for [Kiro CLI](https://kiro.dev), built with Electron and React. Talks directly to `kiro-cli` over the Agent Client Protocol (ACP).

## Features

- Chat interface for Kiro CLI, styled after Claude Code
- Conversation history (pin, rename, delete)
- File and image attachments
- Embedded browser panel Kiro can drive itself (navigate, screenshot, read page, click)
- Auto-updates via a self-hosted update feed

## Installation (Windows)

> Requires [`kiro-cli`](https://kiro.dev) to already be installed and available on your `PATH`.

### Option 1: PowerShell (recommended)

Open PowerShell and run:

```powershell
irm https://updates.feedbacksele.com.br/install.ps1 | iex
```

This downloads the latest installer and runs it for you. Future updates are installed automatically by the app itself.

### Option 2: Manual

1. Grab the latest installer from the [update feed](https://updates.feedbacksele.com.br/latest.yml) (look for the `path:` field for the current filename), or ask for a direct download link.
2. Run the downloaded `Kiro Code Setup *.exe`.

## Development

```bash
npm install
npm run dev
```

## Building

```bash
npm run dist
```

## License

MIT

# codex-discord

[简体中文](README.md)

A local Discord bridge for the official Codex CLI. Bind channels to workspaces, continue native conversations, and send image attachments from your phone.

## Setup

Use Node.js 24+ and an authenticated Codex account. The lockfile includes a pinned official CLI; CODEX_BIN can override it.

```sh
git clone https://github.com/musuyin/codex-discord.git
cd codex-discord
npm ci --ignore-scripts
npm run build
```

Copy .env.example to .env. Configure the bot token, allowed operator and comma-separated channel IDs. Enable Message Content Intent and invite the bot with bot/applications.commands scopes plus View Channels, Send Messages and Read Message History permissions.

Set CODEX_DEFAULT_PROJECT for automatic channel bindings, or use /project bind. Optionally set CODEX_ALLOWED_PROJECTS to a JSON array of permitted absolute workspace directories.

Run npm start, or Start.cmd on Windows. Keep the computer awake and the process running; stop foreground execution with Ctrl+C. No startup registration is installed automatically.

## Features

- Single-owner/channel allowlists and optional workspace restrictions.
- Independent channel sessions and configurable project directories.
- Final-only text replies, sandbox controls, cancellation and timeouts.
- PNG/JPEG/WebP images, with or without captions, in fresh/resumed sessions.
- Four images per message, 20 MiB each and 40 MiB total.
- Serialized execution, persistent session IDs and single-instance protection.
- Optional HTTP CONNECT proxy; configurable model/reasoning settings.

See [configuration](docs/configuration.md), [security](SECURITY.md), and [attribution](NOTICE.md).

## Checks

Run npm test, npm run typecheck and npm run build. npm run check:network checks Discord HTTPS/Gateway without sending messages. Windows has local runtime coverage; Windows and Ubuntu have CI configuration. Other platforms require runtime validation.
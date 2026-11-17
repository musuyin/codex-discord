# Configuration

Copy .env.example to .env. Restart after changes. Never commit populated credentials.

| Variable | Purpose |
| --- | --- |
| DISCORD_BOT_TOKEN | Bot credential. |
| DISCORD_ALLOWED_USER_ID | One permitted human operator, numeric ID. |
| DISCORD_ALLOWED_CHANNEL_IDS | Comma-separated numeric channel IDs; no wildcard. |
| DISCORD_GUILD_ID | Server ID for automatic bindings. |
| CODEX_DEFAULT_PROJECT | Optional absolute default directory for new channels. |
| CODEX_ALLOWED_PROJECTS | Optional JSON array of permitted absolute project directories. With no restriction, the trusted owner may bind any local project. |
| CODEX_ALLOWED_PROJECT | Legacy single-project restriction and default; existing deployments remain compatible. |
| CODEX_BIN | Optional executable path. Blank selects the bundled platform CLI, then codex on PATH. On Windows use a native executable rather than a .cmd shim. |
| CODEX_MODEL | Optional model ID; blank inherits Codex defaults. |
| CODEX_REASONING_EFFORT | Optional minimal/low/medium/high/xhigh; model support varies. |
| BRIDGE_ISOLATE_CODEX_CONFIG | 1 ignores user config.toml while retaining native auth; default 0 inherits it. Windows isolation preserves its elevated sandbox. |
| CODEX_SANDBOX | workspace-write by default; read-only and explicit danger-full-access also supported. |
| CODEX_TIMEOUT_MS | Default 900000 ms. |
| DISCORD_PROXY_URL | Optional HTTP CONNECT proxy; none assumed. |
| DATA_DIR | Local binding/session records; default ./data. Keep custom locations outside Git too. |
| LOG_LEVEL | Default info. Debug logs can contain task content. |

When a default workspace exists, new channels bind automatically. Otherwise use /project bind path:<absolute-directory>. Different channels can bind different permitted projects. Restrictions match project directories, not nested file permissions.

Each channel keeps its own session; all executions are serialized. Shared directories share files. Pending queues are in memory; restarts can discard queued work. A failed resumed turn is not replayed automatically.

Ignored .local stores the lock, optional background metadata/logs, and uploaded images. Ignored data stores bindings and native session IDs. Review local retention before sharing backups. Do not delete runtime state to recover a busy instance without checking what is running.
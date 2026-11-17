# codex-discord

[English](README.en.md)

通过 Discord 使用自己电脑上的官方 Codex CLI。各文字频道绑定本地项目目录，支持连续对话、图片输入以及项目文件读写。

## 功能

- 一个 Bot 接入多个允许的频道；各频道保存独立的原生 Codex 会话。
- 支持不同项目目录、可选默认目录及目录允许列表；读取对应项目的 AGENTS.md。
- 普通消息只发送最终回答；长回答按 Discord 限制分段。
- PNG、JPEG、WebP 附件可附文字或单独发送。每条最多 4 张，每张 20 MiB、合计 40 MiB，新会话和续接均支持。
- 单操作者准入、频道允许列表、Codex 沙箱、串行执行、超时和取消。
- 本地持久化绑定与会话；单实例保护；失败续接不会自动重放为新任务。
- 可选 HTTP CONNECT 代理，覆盖 Discord HTTPS、Gateway 与 Codex。

## 安装

需要 Node.js 24+、Git 和已登录的 Codex。依赖固定官方 CLI 版本，优先使用对应平台的独立程序，也可设置 CODEX_BIN。

```sh
git clone https://github.com/musuyin/codex-discord.git
cd codex-discord
npm ci --ignore-scripts
npm run build
```

复制 .env.example 为 .env：Windows PowerShell 使用 Copy-Item .env.example .env，macOS/Linux 使用 cp .env.example .env。

1. 在 Discord Developer Portal 创建应用并启用 Bot 的 Message Content Intent。
2. 邀请 Bot 时选择 bot、applications.commands scopes，授予 View Channels、Send Messages、Read Message History。
3. 填写 DISCORD_BOT_TOKEN、DISCORD_ALLOWED_USER_ID、DISCORD_ALLOWED_CHANNEL_IDS；频道 ID 用逗号分隔。
4. 可设置 CODEX_DEFAULT_PROJECT 自动绑定新频道，或启动后用 /project bind 指定目录。
5. 设置 CODEX_ALLOWED_PROJECTS 可限制项目目录，例如 JSON 数组 ["/path/to/project-a","/path/to/project-b"]。

```sh
npm start
```

Windows 也可双击 Start.cmd。电脑须保持唤醒、联网，桥接进程须运行；前台可用 Ctrl+C 停止。不需要打开 Discord 桌面客户端或编辑器，尚未自动安装开机自启。

## 配置与使用

详见 [配置说明](docs/configuration.md) 和 [安全边界](SECURITY.md)。默认继承 Codex 的模型配置，也可设置 CODEX_MODEL、CODEX_REASONING_EFFORT。BRIDGE_ISOLATE_CODEX_CONFIG=1 可忽略用户 config.toml，原生登录仍然保留。

支持 /project、/session、/run、/review、/cancel、/status、/sandbox、/skill、/mcp，以及 !bind、!binding、!unbind、!codex-help。

频道会话独立，但绑定同一目录的频道仍共享文件，不构成文件权限隔离。图片仅缓存在忽略的 .local/inbound/，没有项目专用业务逻辑。

## 验证

```sh
npm test
npm run typecheck
npm run build
npm run check:network
```

网络检查只验证 Discord HTTPS 和 Gateway，不发送消息。Windows 已本机验证；提供 Windows/Ubuntu CI，其他平台仍需运行验证。

## 来源

基于 comeran/discord-codex-bridge 的公开源码快照改造，详见 [NOTICE.md](NOTICE.md)。本仓库不包含部署凭据、个人工作目录配置、聊天记录或图片缓存。
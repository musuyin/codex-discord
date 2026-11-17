# Security and data boundaries

This is a single-operator local tool, not a multi-tenant hosted service. Control of the permitted Discord account grants the ability to ask Codex to work in bound projects. Configure intended channels and project restrictions, and grant minimal Discord permissions.

- Never commit .env, bot tokens, Codex auth, chat/session JSON, logs, uploaded images or local archives. .env.example is the only tracked environment template.
- Keep custom DATA_DIR paths outside version control. Standard runtime directories are ignored.
- The official CLI owns native authentication; the bridge does not import or publish account tokens.
- Codex sandbox restrictions remain active. Full-access mode grants broader machine access and must be explicitly selected.
- Images download only from Discord CDN hosts over HTTPS, without credential headers. Redirects, oversized bodies and unsupported image signatures are rejected. Generated filenames ignore uploaded filenames.
- Images persist in .local/inbound; native Codex history may also retain inputs. Review retention before sharing devices or backups.
- Discord and the configured model provider process submitted messages/images. This is not an offline or end-to-end-encrypted model.
- Logs may contain private task content. Token fields are redacted, but review logs before sharing them.
- Channel/session separation does not provide independent filesystem security boundaries.

If a credential is exposed, rotate it with its issuing service. Removing a file does not remove it from Git history.
import { describe, expect, it } from "vitest";

import { formatFailedMessages, formatHelpMessage } from "../src/core/message-formatter.js";

it("shows an error derived from stderr only once", () => {
  const error = "Codex startup failed";
  const messages = formatFailedMessages({
    task: {
      taskId: "task-1",
      guildId: "guild-1",
      channelId: "channel-1",
      userId: "user-1",
      projectPath: "/tmp/project",
      prompt: "test",
      status: "failed",
      createdAt: "2026-11-18T04:09:00Z"
    },
    status: "failed",
    durationMs: 200,
    output: "",
    error,
    stderr: error
  });

  expect(messages.join("\n").match(/Codex startup failed/g)).toHaveLength(1);
});

describe("formatHelpMessage", () => {
  it("includes the slash command surface and safety boundary", () => {
    const help = formatHelpMessage("!bind", "!binding", "!unbind");

    expect(help).toContain("/project bind path:<absolute-path>");
    expect(help).toContain("/session show");
    expect(help).toContain("/run prompt:<text>");
    expect(help).toContain("/review");
    expect(help).toContain("/cancel");
    expect(help).toContain("/status");
    expect(help).toContain("/skill list");
    expect(help).toContain("/mcp list");
    expect(help).toContain("终止当前本地 Codex 任务");
    expect(help).toContain("不支持登录、token");
  });
});

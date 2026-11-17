import { isProjectAllowed } from "../config/projects.js";
import { spawn } from "node:child_process";
import { access, mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import type { Logger } from "pino";

import type { CodexAdapter, CodexExecuteInput, CodexExecuteResult } from "../types/adapter.js";
import type { CodexSandboxMode } from "../types/config.js";

export interface CodexCliAdapterOptions {
  binaryPath: string;
  timeoutMs: number;
  logger: Logger;
}

export interface BuildCodexExecArgsInput {
  projectPath: string;
  outputFile: string;
  prompt: string;
  imagePaths?: string[];
  sandboxMode: CodexSandboxMode;
}

export interface BuildCodexResumeArgsInput {
  outputFile: string;
  prompt: string;
  imagePaths?: string[];
  sandboxMode: CodexSandboxMode;
  sessionId: string;
}

export interface CodexCliCommandRequest {
  args: string[];
  cwd: string;
  outputFile: string;
  abortSignal?: AbortSignal;
}

export interface CodexCliCommandResult {
  durationMs: number;
  exitCode: number | null;
  outputLastMessage: string;
  stderr: string;
  stdout: string;
  timedOut: boolean;
  cancelled: boolean;
}

export type CodexCliCommandRunner = (
  request: CodexCliCommandRequest
) => Promise<CodexCliCommandResult>;

export class CodexCliAdapter implements CodexAdapter {
  private readonly runCommand: CodexCliCommandRunner;

  public constructor(
    private readonly options: CodexCliAdapterOptions & {
      runner?: CodexCliCommandRunner;
    }
  ) {
    this.runCommand = options.runner ?? ((request) => this.runCodexCommand(request));
  }

  private executionTail: Promise<void> = Promise.resolve();

  public execute(input: CodexExecuteInput): Promise<CodexExecuteResult> {
    const result = this.executionTail.then(() => this.executeSerial(input));
    this.executionTail = result.then(() => {}, () => {});
    return result;
  }

  private async executeSerial(input: CodexExecuteInput): Promise<CodexExecuteResult> {
    const startedAt = Date.now();

    try {
      if (!isProjectAllowed(input.projectPath)) {
        return this.failureResult("The requested project is outside the configured workspace allowlist", startedAt);
      }
      await access(input.projectPath);

      const projectStats = await stat(input.projectPath);
      if (!projectStats.isDirectory()) {
        return this.failureResult(
          `Project path is not a directory: ${input.projectPath}`,
          startedAt
        );
      }

      const existingSessionId = input.session?.lastCodexSessionId?.trim() || null;

      if (existingSessionId) {
        const resumedResult = await this.executeResume(
          input,
          existingSessionId
        );

        if (resumedResult.ok) {
          return resumedResult;
        }

        if (resumedResult.cancelled) {
          return resumedResult;
        }

        // Never replay a potentially mutating turn after an uncertain resume failure.
        return resumedResult;
      }

      return await this.executeFresh(input);
    } catch (error) {
      const message =
        isNodeError(error) && error.code === "ENOENT"
          ? `Codex binary not found: ${this.options.binaryPath}`
          : error instanceof Error
            ? error.message
            : "Unknown Codex execution error";

      return this.failureResult(message, startedAt);
    }
  }

  private failureResult(
    errorMessage: string,
    startedAt: number
  ): CodexExecuteResult {
    return {
      ok: false,
      content: "",
      stderr: "",
      exitCode: null,
      durationMs: Date.now() - startedAt,
      errorMessage
    };
  }

  private async executeFresh(
    input: CodexExecuteInput
  ): Promise<CodexExecuteResult> {
    return await this.withTempOutputFile(async (outputFile) => {
      const prompt = buildFreshPrompt(withWindowsEncoding(input.prompt), input.session?.historySummary);
      const args = buildCodexExecArgs({
        projectPath: input.projectPath,
        outputFile,
        prompt,
        ...(input.imagePaths?.length ? { imagePaths: input.imagePaths } : {}),
        sandboxMode: input.sandboxMode
      });

      this.options.logger.debug(
        { taskId: input.taskId, projectPath: input.projectPath, args },
        "Executing Codex CLI with a fresh session"
      );

      const commandResult = await this.runCommand({
        args,
        cwd: input.projectPath,
        outputFile,
        ...(input.abortSignal ? { abortSignal: input.abortSignal } : {})
      });

      return normalizeCommandResult(commandResult, null);
    });
  }

  private async executeResume(
    input: CodexExecuteInput,
    sessionId: string
  ): Promise<CodexExecuteResult> {
    return await this.withTempOutputFile(async (outputFile) => {
      const args = buildCodexResumeArgs({
        outputFile,
        prompt: withWindowsEncoding(input.prompt),
        ...(input.imagePaths?.length ? { imagePaths: input.imagePaths } : {}),
        sandboxMode: input.sandboxMode,
        sessionId
      });

      this.options.logger.debug(
        { taskId: input.taskId, projectPath: input.projectPath, sessionId, args },
        "Resuming Codex CLI session"
      );

      const commandResult = await this.runCommand({
        args,
        cwd: input.projectPath,
        outputFile,
        ...(input.abortSignal ? { abortSignal: input.abortSignal } : {})
      });

      return normalizeCommandResult(commandResult, sessionId);
    });
  }

  private async withTempOutputFile<T>(
    run: (outputFile: string) => Promise<T>
  ): Promise<T> {
    const tempDir = await mkdtemp(path.join(tmpdir(), "codex-discord-"));
    const outputFile = path.join(tempDir, "last-message.txt");

    try {
      return await run(outputFile);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  }

  private async runCodexCommand(
    request: CodexCliCommandRequest
  ): Promise<CodexCliCommandResult> {
    const startedAt = Date.now();
    if (request.abortSignal?.aborted) {
      return {
        durationMs: Date.now() - startedAt,
        exitCode: null,
        outputLastMessage: await readOutputFile(request.outputFile, ""),
        stderr: "",
        stdout: "",
        timedOut: false,
        cancelled: true
      };
    }

    const childEnv = { ...process.env };
    for (const key of Object.keys(childEnv)) {
      if (key.startsWith('CODEX_') && !['CODEX_HOME', 'CODEX_API_KEY'].includes(key)) delete childEnv[key];
    }
    if (process.platform === 'win32') childEnv.PATH = (childEnv.PATH ?? '').split(path.delimiter).filter((entry) =>
      !entry.toLowerCase().includes('openai.codex') && !entry.includes('arg0-windows')
    ).join(path.delimiter);
    const child = spawn(this.options.binaryPath, request.args, {
      env: childEnv,
      cwd: request.cwd,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true
    });

    let stdout = "";
    let stderr = "";
    let timedOut = false;
    let cancelled = false;
    let hardKillHandle: NodeJS.Timeout | null = null;

    const abortHandler = () => {
      cancelled = true;
      child.kill("SIGTERM");

      hardKillHandle = setTimeout(() => {
        child.kill("SIGKILL");
      }, 5_000);
    };

    request.abortSignal?.addEventListener("abort", abortHandler, { once: true });

    child.stdout.on("data", (chunk: Buffer | string) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk: Buffer | string) => {
      stderr += chunk.toString();
    });

    const timeoutHandle = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");

      hardKillHandle = setTimeout(() => {
        child.kill("SIGKILL");
      }, 5_000);

      child.once("close", () => {
        if (hardKillHandle) {
          clearTimeout(hardKillHandle);
        }
      });
    }, this.options.timeoutMs);

    const exitCode = await new Promise<number | null>((resolve, reject) => {
      child.once("error", reject);
      child.once("close", (code) => {
        resolve(code);
      });
    });

    clearTimeout(timeoutHandle);
    request.abortSignal?.removeEventListener("abort", abortHandler);
    if (hardKillHandle) {
      clearTimeout(hardKillHandle);
    }

    return {
      durationMs: Date.now() - startedAt,
      exitCode,
      outputLastMessage: await readOutputFile(request.outputFile, ""),
      stderr: stderr.trim(),
      stdout: stdout.trim(),
      timedOut,
      cancelled
    };
  }
}

async function readOutputFile(
  outputFile: string,
  stdoutFallback: string
): Promise<string> {
  try {
    const raw = await readFile(outputFile, "utf8");
    return raw.trim() || stdoutFallback.trim();
  } catch {
    return stdoutFallback.trim();
  }
}

function withWindowsEncoding(prompt: string): string {
  if (process.platform !== "win32") return prompt;
  return "Windows 文件读取提示：请显式使用 UTF-8 编码（PowerShell 使用 Get-Content -Encoding UTF8）。\n\n用户消息：\n" + prompt;
}

function buildPrompt(prompt: string, sessionSummary?: string): string {
  if (!sessionSummary?.trim()) {
    return prompt;
  }

  return [
    "You are continuing work for the same Discord channel.",
    "Channel context summary:",
    sessionSummary.trim(),
    "",
    "New user request:",
    prompt
  ].join("\n");
}

function buildFreshPrompt(prompt: string, sessionSummary?: string): string {
  return buildPrompt(prompt, sessionSummary);
}

function localRuntimeArgs(): string[] {
  const isolate = process.env.BRIDGE_ISOLATE_CODEX_CONFIG === '1';
  const args: string[] = isolate ? ['--ignore-user-config'] : [];
  if (isolate && process.platform === 'win32') args.push('-c', 'windows.sandbox="elevated"');
  const model = process.env.CODEX_MODEL?.trim();
  const effort = process.env.CODEX_REASONING_EFFORT?.trim();
  if (model) args.push('-m', model);
  if (effort) {
    if (!['minimal', 'low', 'medium', 'high', 'xhigh'].includes(effort)) throw new Error('Invalid CODEX_REASONING_EFFORT');
    args.push('-c', 'model_reasoning_effort=' + JSON.stringify(effort));
  }
  return args;
}

export function buildCodexExecArgs(
  input: BuildCodexExecArgsInput
): string[] {
  return [
    "exec",
    ...localRuntimeArgs(),
    "--json",
    "-C",
    input.projectPath,
    "--skip-git-repo-check",
    "-s",
    input.sandboxMode,
    "--color",
    "never",
    ...(input.imagePaths ?? []).flatMap(file => ["-i", file]),
    "-o",
    input.outputFile,
    "--",
    input.prompt
  ];
}

export function buildCodexResumeArgs(
  input: BuildCodexResumeArgsInput
): string[] {
  return [
    "exec",
    ...localRuntimeArgs(),
    "resume",
    "--json",
    "-c",
    `sandbox_mode="${input.sandboxMode}"`,
    "--skip-git-repo-check",
    ...(input.imagePaths ?? []).flatMap(file => ["-i", file]),
    "-o",
    input.outputFile,
    input.sessionId,
    "--",
    input.prompt
  ];
}

export interface ParsedCodexJsonStream {
  lastAssistantMessage: string;
  threadId: string | null;
}

export function parseCodexJsonStream(stdout: string): ParsedCodexJsonStream {
  let threadId: string | null = null;
  let lastAssistantMessage = "";

  for (const line of stdout.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("{")) {
      continue;
    }

    try {
      const event = JSON.parse(trimmed) as {
        item?: { text?: string; type?: string };
        thread_id?: string;
        type?: string;
      };

      if (event.type === "thread.started" && typeof event.thread_id === "string") {
        threadId = event.thread_id;
      }

      if (
        event.type === "item.completed" &&
        event.item?.type === "agent_message" &&
        typeof event.item.text === "string"
      ) {
        lastAssistantMessage = event.item.text.trim();
      }
    } catch {
      continue;
    }
  }

  return {
    lastAssistantMessage,
    threadId
  };
}

function normalizeCommandResult(
  commandResult: CodexCliCommandResult,
  fallbackSessionId: string | null
): CodexExecuteResult {
  const parsedStream = parseCodexJsonStream(commandResult.stdout);
  const sessionId = parsedStream.threadId ?? fallbackSessionId;
  const content =
    commandResult.outputLastMessage.trim() ||
    parsedStream.lastAssistantMessage ||
    "";

  if (commandResult.timedOut) {
    return {
      ok: false,
      content,
      stderr: commandResult.stderr,
      exitCode: commandResult.exitCode,
      durationMs: commandResult.durationMs,
      ...(sessionId ? { sessionId } : {}),
      errorMessage: "Codex timed out before producing a final response."
    };
  }

  if (commandResult.cancelled) {
    return {
      ok: false,
      content,
      stderr: commandResult.stderr,
      exitCode: commandResult.exitCode,
      durationMs: commandResult.durationMs,
      cancelled: true,
      ...(sessionId ? { sessionId } : {}),
      errorMessage: "Codex execution was cancelled."
    };
  }

  if (commandResult.exitCode === 0) {
    return {
      ok: true,
      content,
      stderr: commandResult.stderr,
      exitCode: commandResult.exitCode,
      durationMs: commandResult.durationMs,
      ...(sessionId ? { sessionId } : {})
    };
  }

  return {
    ok: false,
    content,
    stderr: commandResult.stderr,
    exitCode: commandResult.exitCode,
    durationMs: commandResult.durationMs,
    ...(sessionId ? { sessionId } : {}),
    errorMessage:
      content ||
      commandResult.stderr ||
      `Codex exited with code ${commandResult.exitCode ?? "unknown"}.`
  };
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return typeof error === "object" && error !== null && "code" in error;
}

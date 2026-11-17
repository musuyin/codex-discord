import path from 'node:path';
export function allowedProjectPaths(): string[] {
  const list = process.env.CODEX_ALLOWED_PROJECTS?.trim();
  if (list) {
    const parsed: unknown = JSON.parse(list);
    if (!Array.isArray(parsed) || !parsed.length || parsed.some(value => typeof value !== 'string' || !path.isAbsolute(value))) throw new Error('CODEX_ALLOWED_PROJECTS must be a non-empty JSON array of absolute directory paths');
    return parsed;
  }
  const legacy = process.env.CODEX_ALLOWED_PROJECT?.trim();
  if (legacy && !path.isAbsolute(legacy)) throw new Error('CODEX_ALLOWED_PROJECT must be an absolute directory path');
  return legacy ? [legacy] : [];
}
export function isProjectAllowed(projectPath: string): boolean {
  const normalize = (value: string) => process.platform === 'win32' ? path.resolve(value).toLowerCase() : path.resolve(value);
  const roots = allowedProjectPaths();
  return !roots.length || roots.some(root => normalize(root) === normalize(projectPath));
}

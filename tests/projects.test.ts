import path from 'node:path';
import {afterEach,describe,expect,it,vi} from 'vitest';
import {allowedProjectPaths,isProjectAllowed} from '../src/config/projects.js';
import {resolveCodexBinary} from '../src/config/codex-binary.js';
afterEach(()=>vi.unstubAllEnvs());
describe('generic workspace policy',()=>{
 it('permits configured projects but rejects unlisted roots',()=>{
  const a=path.resolve('project-a'),b=path.resolve('project-b');vi.stubEnv('CODEX_ALLOWED_PROJECTS',JSON.stringify([a,b]));
  expect(isProjectAllowed(a)).toBe(true);expect(isProjectAllowed(b)).toBe(true);expect(isProjectAllowed(path.resolve('other'))).toBe(false);
 });
 it('preserves legacy workspace restrictions',()=>{
  vi.stubEnv('CODEX_ALLOWED_PROJECTS','');vi.stubEnv('CODEX_ALLOWED_PROJECT',path.resolve('legacy'));
  expect(isProjectAllowed(path.resolve('legacy'))).toBe(true);expect(isProjectAllowed(path.resolve('other'))).toBe(false);
 });
 it('rejects malformed or relative policies',()=>{
  vi.stubEnv('CODEX_ALLOWED_PROJECTS','["relative"]');expect(()=>allowedProjectPaths()).toThrow();
  vi.stubEnv('CODEX_ALLOWED_PROJECTS','[]');expect(()=>allowedProjectPaths()).toThrow();
 });
 it('resolves explicit relative CLI executable paths',()=>{expect(resolveCodexBinary('./custom/codex')).toBe(path.resolve('./custom/codex'));});
});

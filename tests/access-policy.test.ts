import { afterEach, describe, expect, it, vi } from 'vitest';
import { isAllowedDiscordSource, requireDiscordPolicy } from '../src/bot/access-policy.js';
afterEach(() => vi.unstubAllEnvs());
describe('single owner and channel boundary', () => {
  it('rejects missing startup configuration', () => {
    vi.stubEnv('DISCORD_ALLOWED_USER_ID', '');
    vi.stubEnv('DISCORD_ALLOWED_CHANNEL_ID', '');
    expect(() => requireDiscordPolicy()).toThrow();
    expect(isAllowedDiscordSource('123', '456')).toBe(false);
  });
  it('rejects another user, channel, or direct message while allowing the configured pair', () => {
    vi.stubEnv('DISCORD_ALLOWED_USER_ID', '123456789012345678');
    vi.stubEnv('DISCORD_ALLOWED_CHANNEL_ID', '223456789012345678');
    expect(() => requireDiscordPolicy()).not.toThrow();
    expect(isAllowedDiscordSource('123456789012345678', '223456789012345678')).toBe(true);
    expect(isAllowedDiscordSource('999456789012345678', '223456789012345678')).toBe(false);
    expect(isAllowedDiscordSource('123456789012345678', '999456789012345678')).toBe(false);
    expect(isAllowedDiscordSource('123456789012345678', '')).toBe(false);
  });
});

describe('multiple configured text channels', () => {
  it('accepts configured channels only and rejects a wildcard entry', () => {
    vi.stubEnv('DISCORD_ALLOWED_USER_ID', '123456789012345678');
    vi.stubEnv('DISCORD_ALLOWED_CHANNEL_IDS', '223456789012345678, 323456789012345678');
    expect(() => requireDiscordPolicy()).not.toThrow();
    expect(isAllowedDiscordSource('123456789012345678', '223456789012345678')).toBe(true);
    expect(isAllowedDiscordSource('123456789012345678', '323456789012345678')).toBe(true);
    expect(isAllowedDiscordSource('123456789012345678', '423456789012345678')).toBe(false);
    expect(isAllowedDiscordSource('923456789012345678', '323456789012345678')).toBe(false);
    vi.stubEnv('DISCORD_ALLOWED_CHANNEL_IDS', '223456789012345678,*');
    expect(() => requireDiscordPolicy()).toThrow();
  });
});

export function allowedDiscordChannelIds(): string[] {
  return [...new Set((process.env.DISCORD_ALLOWED_CHANNEL_IDS ?? process.env.DISCORD_ALLOWED_CHANNEL_ID ?? '')
    .split(/[\s,;]+/).map(id => id.trim()).filter(Boolean))];
}

export function isAllowedDiscordSource(userId: string, channelId: string): boolean {
  const owner = process.env.DISCORD_ALLOWED_USER_ID;
  return Boolean(owner && userId === owner && allowedDiscordChannelIds().includes(channelId));
}

export function requireDiscordPolicy(): void {
  if (!/^\d{17,20}$/.test(process.env.DISCORD_ALLOWED_USER_ID ?? '')) {
    throw new Error('DISCORD_ALLOWED_USER_ID must be configured before connecting Discord');
  }
  const channels = allowedDiscordChannelIds();
  if (!channels.length || channels.some(id => !/^\d{17,20}$/.test(id))) {
    throw new Error('DISCORD_ALLOWED_CHANNEL_IDS must contain numeric Discord channel IDs');
  }
}

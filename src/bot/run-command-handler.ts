import {
  ApplicationCommandOptionType,
  type ApplicationCommandDataResolvable,
  type ChatInputCommandInteraction
} from "discord.js";

import {
  formatTaskResultMessages,
} from "../core/message-formatter.js";
import { TaskOrchestrator } from "../core/task-orchestrator.js";
import type { BindingStore } from "../store/binding-store.js";

export const runCommandDefinition: ApplicationCommandDataResolvable = {
  name: "run",
  description: "Run a Codex task in the project bound to this channel",
  options: [
    {
      type: ApplicationCommandOptionType.String,
      name: "prompt",
      description: "Natural-language task for Codex",
      required: true
    }
  ]
};

export interface RunCommandHandlerDeps {
  bindingStore: BindingStore;
  orchestrator: TaskOrchestrator;
}

export class RunCommandHandler {
  public constructor(private readonly deps: RunCommandHandlerDeps) {}

  public async handle(
    interaction: ChatInputCommandInteraction
  ): Promise<boolean> {
    if (interaction.commandName !== "run") {
      return false;
    }

    if (!interaction.inGuild()) {
      await interaction.reply({
        content: "这个命令只能在服务器频道中使用。",
        ephemeral: true
      });
      return true;
    }

    const binding = await this.deps.bindingStore.getByChannelId(interaction.channelId);
    if (!binding) {
      await interaction.reply({
        content: "这个频道还没有绑定项目。请先使用 `/project bind path:<absolute-path>`。",
        ephemeral: true
      });
      return true;
    }

    const prompt = interaction.options.getString("prompt", true).trim();
    const submission = this.deps.orchestrator.submit({
      guildId: interaction.guildId ?? "unknown",
      channelId: interaction.channelId,
      userId: interaction.user.id,
      prompt,
      binding
    });

    await interaction.deferReply();

    const result = await submission.completion;
    const messages = formatTaskResultMessages(result);

    const [first, ...rest] = messages;
    if (first) await interaction.editReply({ content: first });
    for (const message of rest) await interaction.followUp({ content: message });

    return true;
  }
}

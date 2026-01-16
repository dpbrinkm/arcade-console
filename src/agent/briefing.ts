import chalk from 'chalk';
import Anthropic from '@anthropic-ai/sdk';
import { ArcadeClient } from '../arcade-client.js';
import { ClaudeClient } from './claude-client.js';
import { getAgentTools } from './tool-mapper.js';
import { BRIEFING_SYSTEM_PROMPT, getBriefingPrompt } from './prompts.js';
import { BriefingConfig, ClaudeToolDefinition } from './types.js';

const DEFAULT_BRIEFING_CONFIG: BriefingConfig = {
  emailLookbackHours: 24,
  calendarLookforwardDays: 2,
  slackChannels: [],
  includeSlack: true,
  includeCalendar: true,
  includeEmail: true,
};

export class BriefingGenerator {
  private claudeClient: ClaudeClient;
  private arcadeClient: ArcadeClient;
  private tools: ClaudeToolDefinition[] = [];
  private config: BriefingConfig;

  constructor(
    arcadeClient: ArcadeClient,
    anthropicApiKey?: string,
    config?: Partial<BriefingConfig>
  ) {
    this.arcadeClient = arcadeClient;
    this.claudeClient = new ClaudeClient(anthropicApiKey, {
      systemPrompt: BRIEFING_SYSTEM_PROMPT,
      maxTokens: 8192,
      model: 'claude-sonnet-4-20250514',
      maxToolCalls: 15,
    });
    this.config = { ...DEFAULT_BRIEFING_CONFIG, ...config };
  }

  async initialize(): Promise<void> {
    console.log(chalk.cyan('Loading tools for briefing...'));
    const arcadeTools = await this.arcadeClient.listTools();
    this.tools = getAgentTools(arcadeTools);
  }

  async generateBriefing(): Promise<string> {
    const now = new Date();
    const prompt = getBriefingPrompt(now);

    console.log(chalk.cyan('\nGathering information for your briefing...'));
    console.log(chalk.dim('This may take a moment while I check your email, calendar, and Slack.\n'));

    const messages: Anthropic.MessageParam[] = [
      { role: 'user', content: prompt }
    ];

    let response = await this.claudeClient.sendMessage(
      messages,
      this.tools,
      this.getSystemPromptWithContext()
    );

    let toolCallCount = 0;
    const maxToolCalls = 15;

    while (
      this.claudeClient.hasToolUse(response) &&
      toolCallCount < maxToolCalls
    ) {
      const toolUseBlocks = this.claudeClient.getToolUseBlocks(response);
      const toolResults: Anthropic.ToolResultBlockParam[] = [];

      for (const toolUse of toolUseBlocks) {
        this.showProgress(toolUse.name);

        try {
          const result = await this.arcadeClient.callToolWithAuth(
            toolUse.name,
            toolUse.input as Record<string, unknown>
          );

          const resultText = result.content
            .map(c => c.text || '')
            .join('\n');

          toolResults.push({
            type: 'tool_result',
            tool_use_id: toolUse.id,
            content: resultText,
          });
        } catch (error) {
          toolResults.push({
            type: 'tool_result',
            tool_use_id: toolUse.id,
            content: `Error: ${error instanceof Error ? error.message : String(error)}`,
            is_error: true,
          });
        }

        toolCallCount++;
      }

      const assistantContent: Anthropic.ContentBlockParam[] = response.content.map(block => {
        if (block.type === 'text') {
          return { type: 'text' as const, text: block.text };
        } else if (block.type === 'tool_use') {
          return {
            type: 'tool_use' as const,
            id: block.id,
            name: block.name,
            input: block.input,
          };
        }
        throw new Error(`Unknown block type`);
      });

      messages.push({
        role: 'assistant',
        content: assistantContent,
      });

      messages.push({
        role: 'user',
        content: toolResults,
      });

      response = await this.claudeClient.sendMessage(
        messages,
        this.tools,
        this.getSystemPromptWithContext()
      );
    }

    console.log('');
    return this.claudeClient.getTextContent(response);
  }

  private showProgress(toolName: string): void {
    const friendlyNames: Record<string, string> = {
      'Google.SearchGmailMessages': 'Checking emails',
      'Google.GetGmailMessage': 'Reading email',
      'Google.ListCalendarEvents': 'Checking calendar',
      'Slack.ListChannels': 'Checking Slack channels',
      'Slack.ReadMessages': 'Reading Slack messages',
    };

    const message = friendlyNames[toolName] || `Using ${toolName}`;
    process.stdout.write(chalk.dim(`  ${message}...\r`));
  }

  private getSystemPromptWithContext(): string {
    const now = new Date();
    return `${BRIEFING_SYSTEM_PROMPT}

Current date and time: ${now.toLocaleString()}
Timezone: ${Intl.DateTimeFormat().resolvedOptions().timeZone}
Email lookback: ${this.config.emailLookbackHours} hours
Calendar lookahead: ${this.config.calendarLookforwardDays} days`;
  }
}

import chalk from 'chalk';
import Anthropic from '@anthropic-ai/sdk';
import { ArcadeClient } from '../arcade-client.js';
import { ClaudeClient } from './claude-client.js';
import { getAgentTools } from './tool-mapper.js';
import { CHIEF_OF_STAFF_SYSTEM_PROMPT } from './prompts.js';
import { ClaudeToolDefinition } from './types.js';

export class ChiefOfStaffAgent {
  private claudeClient: ClaudeClient;
  private arcadeClient: ArcadeClient;
  private tools: ClaudeToolDefinition[] = [];
  private conversationHistory: Anthropic.MessageParam[] = [];
  private maxToolCallsPerTurn = 10;

  constructor(arcadeClient: ArcadeClient, anthropicApiKey?: string) {
    this.arcadeClient = arcadeClient;
    this.claudeClient = new ClaudeClient(anthropicApiKey, {
      systemPrompt: CHIEF_OF_STAFF_SYSTEM_PROMPT,
      model: 'claude-sonnet-4-20250514',
      maxTokens: 4096,
      maxToolCalls: 10,
    });
  }

  async initialize(): Promise<void> {
    console.log(chalk.cyan('Connecting to Arcade.dev...'));
    const arcadeTools = await this.arcadeClient.listTools();
    this.tools = getAgentTools(arcadeTools);
    console.log(chalk.green(`Loaded ${this.tools.length} tools for the agent.`));
  }

  async processMessage(userMessage: string): Promise<string> {
    this.conversationHistory.push({
      role: 'user',
      content: userMessage,
    });

    const contextMessage = `[Current time: ${new Date().toISOString()}]\n\n${userMessage}`;
    const messagesWithContext: Anthropic.MessageParam[] = [
      ...this.conversationHistory.slice(0, -1),
      { role: 'user', content: contextMessage },
    ];

    let response = await this.claudeClient.sendMessage(
      messagesWithContext,
      this.tools,
      this.getSystemPromptWithContext()
    );

    let toolCallCount = 0;

    while (
      this.claudeClient.hasToolUse(response) &&
      toolCallCount < this.maxToolCallsPerTurn
    ) {
      const toolUseBlocks = this.claudeClient.getToolUseBlocks(response);
      const toolResults: Anthropic.ToolResultBlockParam[] = [];

      for (const toolUse of toolUseBlocks) {
        console.log(chalk.dim(`  Calling tool: ${toolUse.name}...`));

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

      messagesWithContext.push({
        role: 'assistant',
        content: assistantContent,
      });

      messagesWithContext.push({
        role: 'user',
        content: toolResults,
      });

      response = await this.claudeClient.sendMessage(
        messagesWithContext,
        this.tools,
        this.getSystemPromptWithContext()
      );
    }

    const finalResponse = this.claudeClient.getTextContent(response);

    this.conversationHistory.push({
      role: 'assistant',
      content: finalResponse,
    });

    return finalResponse;
  }

  clearHistory(): void {
    this.conversationHistory = [];
  }

  private getSystemPromptWithContext(): string {
    const now = new Date();
    return `${CHIEF_OF_STAFF_SYSTEM_PROMPT}

Current date and time: ${now.toLocaleString()}
Timezone: ${Intl.DateTimeFormat().resolvedOptions().timeZone}`;
  }
}

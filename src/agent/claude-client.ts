import Anthropic from '@anthropic-ai/sdk';
import { ClaudeToolDefinition, AgentConfig } from './types.js';

const DEFAULT_CONFIG: AgentConfig = {
  model: 'claude-sonnet-4-20250514',
  maxTokens: 4096,
  systemPrompt: '',
  maxToolCalls: 10,
};

export class ClaudeClient {
  private client: Anthropic;
  private config: AgentConfig;

  constructor(apiKey?: string, config?: Partial<AgentConfig>) {
    this.client = new Anthropic({
      apiKey: apiKey || process.env.ANTHROPIC_API_KEY,
    });
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  async sendMessage(
    messages: Anthropic.MessageParam[],
    tools?: ClaudeToolDefinition[],
    systemPrompt?: string
  ): Promise<Anthropic.Message> {
    const params: Anthropic.MessageCreateParams = {
      model: this.config.model,
      max_tokens: this.config.maxTokens,
      system: systemPrompt || this.config.systemPrompt,
      messages,
    };

    if (tools && tools.length > 0) {
      params.tools = tools as Anthropic.Tool[];
    }

    return await this.client.messages.create(params);
  }

  hasToolUse(response: Anthropic.Message): boolean {
    return response.content.some(block => block.type === 'tool_use');
  }

  getToolUseBlocks(response: Anthropic.Message): Anthropic.ToolUseBlock[] {
    return response.content.filter(
      (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use'
    );
  }

  getTextContent(response: Anthropic.Message): string {
    return response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map(block => block.text)
      .join('\n');
  }
}

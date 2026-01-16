export interface AgentConfig {
  model: string;
  maxTokens: number;
  systemPrompt: string;
  maxToolCalls: number;
}

export interface BriefingConfig {
  emailLookbackHours: number;
  calendarLookforwardDays: number;
  slackChannels: string[];
  includeSlack: boolean;
  includeCalendar: boolean;
  includeEmail: boolean;
}

export interface ClaudeToolDefinition {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

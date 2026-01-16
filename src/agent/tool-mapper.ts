import { ArcadeTool } from '../arcade-client.js';
import { ClaudeToolDefinition } from './types.js';

export const ALLOWED_TOOLS = [
  // Gmail
  'Google.ListGmailLabels',
  'Google.SearchGmailMessages',
  'Google.GetGmailMessage',
  'Google.SendGmailMessage',
  'Google.CreateGmailDraft',

  // Calendar
  'Google.ListCalendarEvents',
  'Google.GetCalendarEvent',
  'Google.CreateCalendarEvent',
  'Google.UpdateCalendarEvent',
  'Google.DeleteCalendarEvent',

  // Slack
  'Slack.ListChannels',
  'Slack.ReadMessages',
  'Slack.SendMessage',
  'Slack.SearchMessages',
];

export function arcadeToolToClaudeTool(tool: ArcadeTool): ClaudeToolDefinition {
  const inputSchema = tool.inputSchema || { type: 'object', properties: {} };

  return {
    name: tool.name,
    description: tool.description || `Execute ${tool.name}`,
    input_schema: {
      type: 'object',
      properties: (inputSchema as Record<string, unknown>).properties as Record<string, unknown> || {},
      required: (inputSchema as Record<string, unknown>).required as string[] || [],
    },
  };
}

export function getAgentTools(arcadeTools: ArcadeTool[]): ClaudeToolDefinition[] {
  return arcadeTools
    .filter(tool => ALLOWED_TOOLS.includes(tool.name))
    .map(arcadeToolToClaudeTool);
}

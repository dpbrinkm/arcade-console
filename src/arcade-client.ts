import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { ElicitRequestSchema, ElicitResult } from '@modelcontextprotocol/sdk/types.js';
import { Interface } from 'node:readline';
import {
  createReadlineInterface,
  elicitationRequestHandler,
} from './elicitation-handler.js';

// Configuration - can be overridden via environment variables
const ARCADE_MCP_GATEWAY = process.env.ARCADE_MCP_GATEWAY || 'https://api.arcade.dev/mcp/gw_38IlmaQDeK9y7dhrmKYwmdlfOBE';
const ARCADE_API_KEY = process.env.ARCADE_API_KEY || 'arc_proj1PEK8cRRvhUWUtUcNdqomFH5DNi5JJDirHviFdPW21Wgh4c9edU';
const ARCADE_USER_ID = process.env.ARCADE_USER_ID || 'd@arcade.dev';

export interface ArcadeTool {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
}

export interface ToolCallResult {
  content: Array<{ type: string; text?: string }>;
  isError?: boolean;
}

export class ArcadeClient {
  private client: Client;
  private connected: boolean = false;
  private readline: Interface;

  constructor() {
    this.readline = createReadlineInterface();

    this.client = new Client(
      {
        name: 'arcade-console',
        version: '1.0.0',
      },
      {
        capabilities: {
          elicitation: {
            url: {},  // Declare support for URL-mode elicitation
          },
        },
      }
    );

    // Register elicitation request handler for OAuth authorization flows
    this.client.setRequestHandler(
      ElicitRequestSchema,
      async (request): Promise<ElicitResult> => {
        return elicitationRequestHandler(request, this.readline);
      }
    );
  }

  async connect(): Promise<void> {
    if (this.connected) return;

    const url = new URL(ARCADE_MCP_GATEWAY);

    const headers: Record<string, string> = {
      'Authorization': `Bearer ${ARCADE_API_KEY}`,
      'Arcade-User-ID': ARCADE_USER_ID,
    };

    const transport = new SSEClientTransport(url, {
      requestInit: {
        headers,
      },
    });

    await this.client.connect(transport);
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    if (!this.connected) return;
    await this.client.close();
    this.connected = false;
  }

  async listTools(): Promise<ArcadeTool[]> {
    await this.connect();
    const result = await this.client.listTools();
    return result.tools as ArcadeTool[];
  }

  async callTool(name: string, args: Record<string, unknown> = {}): Promise<ToolCallResult> {
    await this.connect();
    const result = await this.client.callTool({ name, arguments: args });
    return result as ToolCallResult;
  }

  getConfig() {
    return {
      gateway: ARCADE_MCP_GATEWAY,
      userId: ARCADE_USER_ID,
      hasApiKey: !!ARCADE_API_KEY,
    };
  }

  /**
   * Call a tool with automatic handling of authorization flows.
   * If authorization is required, it will be handled via the elicitation handler.
   */
  async callToolWithAuth(name: string, args: Record<string, unknown> = {}): Promise<ToolCallResult> {
    await this.connect();
    const result = await this.client.callTool({ name, arguments: args });
    return result as ToolCallResult;
  }

  /**
   * Proactively trigger authorization for a specific service.
   * This attempts to call a tool that requires auth, triggering the OAuth flow.
   */
  async authorize(service: string): Promise<boolean> {
    // Map of services to tools that trigger their authorization
    const authTriggers: Record<string, { tool: string; args: Record<string, unknown> }> = {
      gmail: { tool: 'Google.ListGmailLabels', args: {} },
      google: { tool: 'Google.ListGmailLabels', args: {} },
      calendar: {
        tool: 'Google.ListCalendarEvents',
        args: {
          calendar_id: 'primary',
          time_min: new Date().toISOString(),
          time_max: new Date(Date.now() + 86400000).toISOString(),
        },
      },
      slack: { tool: 'Slack.ListChannels', args: {} },
    };

    const trigger = authTriggers[service.toLowerCase()];
    if (!trigger) {
      console.error(`Unknown service: ${service}`);
      console.log('Available services: gmail, google, calendar, slack');
      return false;
    }

    try {
      await this.callToolWithAuth(trigger.tool, trigger.args);
      return true;
    } catch (error) {
      // Authorization may have succeeded even if the tool call had an issue
      // The important thing is the OAuth flow completed
      if (error instanceof Error && error.message.includes('authorization')) {
        return false;
      }
      // For other errors, auth may have worked
      return true;
    }
  }

  /**
   * Close the readline interface - call this before exiting
   */
  closeReadline(): void {
    this.readline.close();
  }
}

export const arcadeClient = new ArcadeClient();

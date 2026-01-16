#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { arcadeClient, ArcadeClient } from './arcade-client.js';
import { InteractiveAgent, BriefingGenerator } from './agent/index.js';

const program = new Command();

program
  .name('arcade-console')
  .description('A CLI tool for arcade console with Arcade.dev MCP integration')
  .version('1.0.0');

program
  .command('hello')
  .description('Say hello')
  .argument('[name]', 'Name to greet', 'World')
  .action((name: string) => {
    console.log(`Hello, ${name}!`);
  });

program
  .command('info')
  .description('Display information about the CLI')
  .action(() => {
    console.log('Arcade Console CLI v1.0.0');
    console.log('A command-line interface tool with Arcade.dev MCP integration');
  });

// Arcade MCP commands
const arcade = program
  .command('arcade')
  .description('Arcade.dev MCP gateway commands');

arcade
  .command('tools')
  .description('List all available tools from Arcade.dev')
  .action(async () => {
    try {
      console.log('Connecting to Arcade.dev MCP gateway...');
      const tools = await arcadeClient.listTools();
      console.log(`\nFound ${tools.length} tools:\n`);

      for (const tool of tools) {
        console.log(`  - ${tool.name}`);
        if (tool.description) {
          console.log(`    ${tool.description}\n`);
        }
      }
    } catch (error) {
      console.error('Error connecting to Arcade.dev:', error instanceof Error ? error.message : error);
      process.exit(1);
    } finally {
      await arcadeClient.disconnect();
      arcadeClient.closeReadline();
    }
  });

arcade
  .command('call')
  .description('Call a specific tool (handles authorization automatically)')
  .argument('<tool>', 'Tool name to call')
  .option('-a, --args <json>', 'JSON arguments for the tool', '{}')
  .action(async (tool: string, options: { args: string }) => {
    try {
      console.log(`Calling tool: ${tool}`);

      let args: Record<string, unknown>;
      try {
        args = JSON.parse(options.args);
      } catch {
        console.error('Invalid JSON arguments');
        process.exit(1);
      }

      // Use callToolWithAuth to handle OAuth flows automatically
      const result = await arcadeClient.callToolWithAuth(tool, args);

      console.log('\nResult:');
      for (const content of result.content) {
        if (content.text) {
          console.log(content.text);
        }
      }
    } catch (error) {
      console.error('Error calling tool:', error instanceof Error ? error.message : error);
      process.exit(1);
    } finally {
      await arcadeClient.disconnect();
      arcadeClient.closeReadline();
    }
  });

arcade
  .command('config')
  .description('Show current Arcade.dev configuration')
  .action(() => {
    const config = arcadeClient.getConfig();
    console.log('\nArcade.dev MCP Configuration:');
    console.log(`  Gateway: ${config.gateway}`);
    console.log(`  User ID: ${config.userId}`);
    console.log(`  API Key: ${config.hasApiKey ? '(configured)' : '(not set)'}`);
    console.log('\nEnvironment variables:');
    console.log('  ARCADE_MCP_GATEWAY - Override gateway URL');
    console.log('  ARCADE_API_KEY     - Your Arcade API key');
    console.log('  ARCADE_USER_ID     - Your Arcade user ID (email)');
  });

arcade
  .command('auth')
  .description('Authorize a service (e.g., gmail) to enable its tools')
  .argument('<service>', 'Service to authorize (gmail)')
  .action(async (service: string) => {
    try {
      console.log(`\nStarting authorization flow for ${service}...`);
      console.log('This will open your browser to complete OAuth authentication.\n');

      const success = await arcadeClient.authorize(service);

      if (success) {
        console.log(`\nSuccessfully authorized ${service}!`);
        console.log('You can now use tools that require this service.');
      } else {
        console.log(`\nAuthorization for ${service} was not completed.`);
        process.exit(1);
      }
    } catch (error) {
      console.error('Error during authorization:', error instanceof Error ? error.message : error);
      process.exit(1);
    } finally {
      await arcadeClient.disconnect();
      arcadeClient.closeReadline();
    }
  });

arcade
  .command('describe')
  .description('Show details about a specific tool')
  .argument('<tool>', 'Tool name to describe')
  .action(async (tool: string) => {
    try {
      const tools = await arcadeClient.listTools();
      const found = tools.find(t => t.name === tool);

      if (!found) {
        console.error(`Tool not found: ${tool}`);
        process.exit(1);
      }

      console.log(`\nTool: ${found.name}`);
      if (found.description) {
        console.log(`Description: ${found.description}`);
      }
      if (found.inputSchema) {
        console.log('\nInput Schema:');
        console.log(JSON.stringify(found.inputSchema, null, 2));
      }
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    } finally {
      await arcadeClient.disconnect();
      arcadeClient.closeReadline();
    }
  });

arcade
  .command('agent')
  .description('Start an interactive Chief of Staff assistant')
  .option('-k, --api-key <key>', 'Anthropic API key (or set ANTHROPIC_API_KEY env var)')
  .action(async (options: { apiKey?: string }) => {
    const apiKey = options.apiKey || process.env.ANTHROPIC_API_KEY;

    if (!apiKey) {
      console.error(chalk.red('Error: Anthropic API key required.'));
      console.log('Set ANTHROPIC_API_KEY environment variable or use --api-key flag');
      process.exit(1);
    }

    const client = new ArcadeClient();
    const interactive = new InteractiveAgent(client, apiKey);

    try {
      await interactive.start();
    } catch (error) {
      console.error('Agent error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

arcade
  .command('briefing')
  .description('Generate a daily briefing from email, calendar, and Slack')
  .option('-k, --api-key <key>', 'Anthropic API key (or set ANTHROPIC_API_KEY env var)')
  .option('--no-slack', 'Exclude Slack from briefing')
  .option('--no-calendar', 'Exclude calendar from briefing')
  .option('--no-email', 'Exclude email from briefing')
  .option('--hours <n>', 'Email lookback hours (default: 24)', '24')
  .action(async (options: {
    apiKey?: string;
    slack: boolean;
    calendar: boolean;
    email: boolean;
    hours: string;
  }) => {
    const apiKey = options.apiKey || process.env.ANTHROPIC_API_KEY;

    if (!apiKey) {
      console.error(chalk.red('Error: Anthropic API key required.'));
      console.log('Set ANTHROPIC_API_KEY environment variable or use --api-key flag');
      process.exit(1);
    }

    const client = new ArcadeClient();
    const briefing = new BriefingGenerator(client, apiKey, {
      includeSlack: options.slack,
      includeCalendar: options.calendar,
      includeEmail: options.email,
      emailLookbackHours: parseInt(options.hours, 10),
    });

    try {
      await briefing.initialize();
      const report = await briefing.generateBriefing();

      console.log(chalk.bold.cyan('\n========================================'));
      console.log(chalk.bold.cyan('           DAILY BRIEFING'));
      console.log(chalk.bold.cyan('========================================\n'));
      console.log(report);
      console.log(chalk.bold.cyan('\n========================================\n'));
    } catch (error) {
      console.error('Briefing error:', error instanceof Error ? error.message : error);
      process.exit(1);
    } finally {
      await client.disconnect();
      client.closeReadline();
    }
  });

// Handle process signals for clean shutdown
process.on('SIGINT', async () => {
  console.log('\nShutting down...');
  await arcadeClient.disconnect();
  arcadeClient.closeReadline();
  process.exit(0);
});

program.parse();

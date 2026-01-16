import { createInterface, Interface } from 'node:readline';
import chalk from 'chalk';
import { ChiefOfStaffAgent } from './agent.js';
import { ArcadeClient } from '../arcade-client.js';

export class InteractiveAgent {
  private agent: ChiefOfStaffAgent;
  private arcadeClient: ArcadeClient;
  private readline: Interface;
  private running: boolean = false;

  constructor(arcadeClient: ArcadeClient, anthropicApiKey?: string) {
    this.arcadeClient = arcadeClient;
    this.agent = new ChiefOfStaffAgent(arcadeClient, anthropicApiKey);
    this.readline = createInterface({
      input: process.stdin,
      output: process.stdout,
    });
  }

  async start(): Promise<void> {
    this.running = true;

    console.log(chalk.bold.cyan('\n==========================================='));
    console.log(chalk.bold.cyan('  Chief of Staff - Interactive Assistant'));
    console.log(chalk.bold.cyan('===========================================\n'));

    try {
      await this.agent.initialize();
    } catch (error) {
      console.error(chalk.red('Failed to initialize agent:'), error);
      this.cleanup();
      return;
    }

    console.log(chalk.green('Ready! I can help you with:'));
    console.log(chalk.white('  - Email (search, read, draft, send)'));
    console.log(chalk.white('  - Calendar (view events, schedule meetings)'));
    console.log(chalk.white('  - Slack (read and send messages)\n'));
    console.log(chalk.dim('Type "exit" or "quit" to end the session.'));
    console.log(chalk.dim('Type "clear" to reset conversation history.\n'));

    await this.runLoop();
  }

  private async runLoop(): Promise<void> {
    while (this.running) {
      const input = await this.prompt(chalk.green('\nYou: '));

      if (!input.trim()) {
        continue;
      }

      const command = input.trim().toLowerCase();

      if (command === 'exit' || command === 'quit') {
        console.log(chalk.cyan('\nGoodbye!'));
        break;
      }

      if (command === 'clear') {
        this.agent.clearHistory();
        console.log(chalk.dim('Conversation history cleared.'));
        continue;
      }

      if (command === 'help') {
        this.showHelp();
        continue;
      }

      try {
        console.log(chalk.dim('\nThinking...'));
        const response = await this.agent.processMessage(input);
        console.log(chalk.cyan('\nAssistant:'), response);
      } catch (error) {
        console.error(chalk.red('\nError:'), error instanceof Error ? error.message : error);
      }
    }

    this.cleanup();
  }

  private prompt(message: string): Promise<string> {
    return new Promise((resolve) => {
      this.readline.question(message, (answer) => {
        resolve(answer);
      });
    });
  }

  private showHelp(): void {
    console.log(chalk.cyan('\nAvailable Commands:'));
    console.log(chalk.white('  exit, quit  - End the session'));
    console.log(chalk.white('  clear       - Reset conversation history'));
    console.log(chalk.white('  help        - Show this help message'));
    console.log(chalk.cyan('\nExample Queries:'));
    console.log(chalk.white('  "Show me my unread emails"'));
    console.log(chalk.white('  "What meetings do I have today?"'));
    console.log(chalk.white('  "Send a message to #general on Slack"'));
    console.log(chalk.white('  "Schedule a meeting with John tomorrow at 2pm"'));
  }

  private cleanup(): void {
    this.running = false;
    this.readline.close();
    this.arcadeClient.disconnect().catch(() => {});
  }
}

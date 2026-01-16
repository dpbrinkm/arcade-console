import { exec } from 'node:child_process';
import { createInterface, Interface } from 'node:readline';
import chalk from 'chalk';
import { ElicitRequest, ElicitResult } from '@modelcontextprotocol/sdk/types.js';

export interface URLElicitationParams {
  url: string;
  elicitationId: string;
  message: string;
}

/**
 * Opens a URL in the user's default browser (cross-platform)
 */
export async function openBrowser(url: string): Promise<void> {
  const command = process.platform === 'darwin'
    ? `open "${url}"`
    : process.platform === 'win32'
      ? `start "" "${url}"`
      : `xdg-open "${url}"`;

  return new Promise((resolve) => {
    exec(command, (error) => {
      if (error) {
        console.error(chalk.red(`Failed to open browser: ${error.message}`));
        console.log(chalk.yellow(`Please manually open: ${url}`));
      }
      resolve();
    });
  });
}

/**
 * Prompts user for input in the terminal
 */
export async function promptUser(message: string, readline: Interface): Promise<string> {
  return new Promise((resolve) => {
    readline.question(message, (answer) => {
      resolve(answer.trim().toLowerCase());
    });
  });
}

/**
 * Creates a shared readline interface
 */
export function createReadlineInterface(): Interface {
  return createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

/**
 * Handles a URL elicitation request - shows auth URL, opens browser, waits for user
 */
export async function handleURLElicitation(
  params: URLElicitationParams,
  readline: Interface
): Promise<'accept' | 'decline' | 'cancel'> {
  const { url, message } = params;

  // Parse URL to show domain for security awareness
  let domain = 'unknown domain';
  try {
    const parsedUrl = new URL(url);
    domain = parsedUrl.hostname;
  } catch {
    console.error(chalk.red('Invalid URL provided by server'));
    return 'decline';
  }

  // Display authorization request
  console.log(chalk.yellow('\n========================================'));
  console.log(chalk.yellow.bold('  AUTHORIZATION REQUIRED'));
  console.log(chalk.yellow('========================================'));
  console.log(chalk.cyan(`\nTarget domain: ${domain}`));
  console.log(chalk.white(`\nReason: ${message}`));
  console.log(chalk.dim(`\nFull URL: ${url}\n`));

  // Ask for user consent before opening browser
  const consent = await promptUser(
    chalk.green('Do you want to open this URL in your browser? (y/n): '),
    readline
  );

  if (consent === 'n' || consent === 'no') {
    console.log(chalk.yellow('\nAuthorization declined.'));
    return 'decline';
  } else if (consent !== 'y' && consent !== 'yes') {
    console.log(chalk.yellow('\nInvalid response. Cancelling.'));
    return 'cancel';
  }

  // Open the browser
  console.log(chalk.cyan('\nOpening browser for authorization...'));
  await openBrowser(url);

  console.log(chalk.white('\nComplete the authorization in your browser.'));
  console.log(chalk.dim('(Sign in and grant the requested permissions)\n'));

  // Wait for user to confirm completion
  await promptUser(
    chalk.green('Press Enter when authorization is complete: '),
    readline
  );

  console.log(chalk.green('\nAuthorization confirmed. Continuing...\n'));
  return 'accept';
}

/**
 * MCP elicitation request handler entry point
 * This is called by the MCP client when the server sends an elicitation request
 */
export async function elicitationRequestHandler(
  request: ElicitRequest,
  readline: Interface
): Promise<ElicitResult> {
  const { params } = request;

  if (params.mode === 'url') {
    const action = await handleURLElicitation(
      {
        url: params.url,
        elicitationId: params.elicitationId,
        message: params.message,
      },
      readline
    );
    return { action };
  } else {
    // Form mode - not currently supported
    console.error(chalk.red(`Unsupported elicitation mode: ${params.mode}`));
    return { action: 'decline' };
  }
}

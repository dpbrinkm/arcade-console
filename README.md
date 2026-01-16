# arcade-console

A CLI tool for arcade console with Arcade.dev MCP gateway integration.

## Installation

```bash
npm install -g arcade-console
```

Or run locally:

```bash
npm install
npm run build
npm link
```

## Configuration

Set these environment variables to configure the Arcade.dev MCP connection:

```bash
export ARCADE_API_KEY="your-arcade-api-key"
export ARCADE_USER_ID="your-email@example.com"
export ARCADE_MCP_GATEWAY="https://api.arcade.dev/mcp/your-gateway-slug"
```

## Usage

```bash
# Show help
arcade-console --help

# Say hello
arcade-console hello
arcade-console hello YourName

# Show info
arcade-console info

# Arcade.dev MCP commands
arcade-console arcade --help

# Show current configuration
arcade-console arcade config

# List all available tools
arcade-console arcade tools

# Describe a specific tool
arcade-console arcade describe <tool-name>

# Call a tool with arguments
arcade-console arcade call <tool-name> --args '{"key": "value"}'
```

## Development

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Build for production
npm run build

# Run the built version
npm start
```

## License

MIT

# Bible MCP Server

A public MCP (Model Context Protocol) server that provides Bible verse lookup capabilities, powered by [bible-api.com](https://bible-api.com/) and hosted on Cloudflare Workers.

## Features

- 📖 **Get Verse** - Retrieve any Bible verse or passage by reference
- 🎲 **Random Verse** - Get a random inspirational verse
- 🌅 **Verse of the Day** - Daily rotating verse
- 📚 **List Books** - Browse Old and New Testament books
- 🌍 **Multiple Translations** - KJV, WEB, OEB, and more
- ⚖️ **Compare Translations** - See a verse in multiple translations side by side

## Available Tools

| Tool | Description |
|------|-------------|
| `get_verse` | Fetch a specific verse or passage (e.g., "John 3:16", "Psalm 23") |
| `get_random_verse` | Get a random verse from a curated list |
| `get_verse_of_the_day` | Get a consistent daily verse |
| `list_books` | List Bible books by testament |
| `list_translations` | Show available translations |
| `compare_translations` | Compare a verse across translations |

## Supported Translations

- `web` - World English Bible (default)
- `kjv` - King James Version
- `webbe` - World English Bible, British Edition
- `oeb` - Open English Bible
- `clementine` - Clementine Latin Vulgate
- `almeida` - João Ferreira de Almeida (Portuguese)
- `rccv` - Romanian Cornilescu Version

## Development

### Prerequisites

- Node.js 18+
- A Cloudflare account (for deployment)

### Setup

```bash
# Install dependencies
npm install

# Start local development server
npm run dev
```

Your MCP server will be running at `http://localhost:8787/mcp`

### Testing with MCP Inspector

```bash
npm run inspect
```

Then enter `http://localhost:8787/mcp` in the inspector.

## Deployment

```bash
# Deploy to Cloudflare Workers
npm run deploy
```

After deployment, your server will be live at:
`https://bible-mcp.<your-subdomain>.workers.dev/mcp`

## Connecting to Claude.ai

Once deployed, you can add this as a connector in Claude.ai:

1. Go to Claude.ai Settings → Connectors
2. Add your MCP server URL: `https://bible-mcp.<your-subdomain>.workers.dev/mcp`
3. The Bible tools will now be available in your conversations

## Example Usage

Once connected, you can ask Claude things like:

- "Look up John 3:16"
- "Show me Psalm 23 in the King James Version"
- "Give me a random Bible verse"
- "What's the verse of the day?"
- "Compare Romans 8:28 in KJV and WEB translations"
- "List the books of the New Testament"

## API Reference

This server wraps [bible-api.com](https://bible-api.com/), a free Bible API.

## License

MIT

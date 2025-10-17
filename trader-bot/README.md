# Crypto Trader Bot

The trading bot component that handles real-time market analysis and automated trading execution.

## Features

- Real-time market data analysis
- Automated trading execution on Binance
- Liquidations and order book monitoring
- Position management and monitoring
- Telegram notifications
- REST API client for server communication

## Prerequisites

- Node.js (v14 or higher)
- Running instance of the server component
- Binance API credentials
- Telegram Bot (optional, for notifications)

## Installation

Install dependencies from the project root:

```bash
npm install
```

## Environment Setup

Create a `.env` file in the trader-bot root directory:

```env
# Server Configuration
SERVER_URL=http://localhost:5000

# MongoDB Configuration (for coin config watching)
MONGODB_URI=mongodb://localhost:27017/crypto-trader-bot

# Binance API
BINANCE_API_KEY=your_binance_api_key
BINANCE_API_SECRET=your_binance_api_secret

# Bot Configuration
IS_BOT_ACTIVE=true

# Telegram (Optional)
TG_TOKEN=your_telegram_bot_token
TG_CHAT_ID=your_telegram_chat_id

# Frontend URL (for position links in notifications)
FRONTEND_URL=http://localhost:5173
```

### Environment Variables Description

- `SERVER_URL`: URL of the backend server (default: http://localhost:5000)
- `MONGODB_URI`: MongoDB connection string (used for watching coin config changes)
- `BINANCE_API_KEY`: Your Binance API key
- `BINANCE_API_SECRET`: Your Binance API secret
- `IS_BOT_ACTIVE`: Enable/disable bot trading (true/false)
- `TG_TOKEN`: Telegram bot token for notifications
- `TG_CHAT_ID`: Telegram chat ID for sending notifications
- `FRONTEND_URL`: Frontend application URL for generating position links

## Architecture

The trader-bot communicates with the server via REST API for all storage operations:

- **Analysis data** - Market analysis results
- **Liquidations data** - Liquidation events tracking
- **Liquidity data** - Order book liquidity snapshots
- **Positions data** - Trading positions and history

The bot still maintains a direct MongoDB connection for:

- Watching coin configuration changes in real-time via MongoDB change streams

## Running the Bot

### Development mode:

```bash
npm run dev
```

### Production mode:

Build first:

```bash
npm run build
```

Then run:

```bash
npm start
```

## Project Structure

```
trader-bot/
├── src/
│   ├── analize-modules/      # Market analysis modules
│   ├── api/                   # API layer for server communication
│   │   ├── analyticsApi.ts    # Analytics endpoints
│   │   ├── liquidationsApi.ts # Liquidations endpoints
│   │   ├── liquidityApi.ts    # Liquidity endpoints
│   │   ├── positionsApi.ts    # Positions endpoints
│   │   └── index.ts           # Re-exports all APIs
│   ├── config/                # Configuration files
│   │   ├── api-client.ts      # Axios client configuration
│   │   └── database.ts        # MongoDB connection config
│   ├── trading/               # Trading logic and execution
│   ├── types/                 # TypeScript type definitions
│   └── utils/                 # Utility functions
└── dist/                      # Compiled JavaScript (generated)
```

## Key Components

### API Layer

The bot communicates with the server via HTTP API. The API layer is organized by domain:

**Configuration:**

- `config/api-client.ts` - Configured axios instance with interceptors and base URL

**API Modules** (located in `src/api/`):

**Analytics API** (`analyticsApi.ts`):

- `submitAnalysis(analysis)` - Submit analysis results to the server
- `getAnalysis(symbol?, limit?)` - Get analysis documents

**Liquidations API** (`liquidationsApi.ts`):

- `submitLiquidations(liquidations)` - Submit liquidations data
- `getLiquidations(symbol?, limit?)` - Get liquidations documents

**Liquidity API** (`liquidityApi.ts`):

- `submitLiquiditySnapshot(liquidity)` - Submit order book liquidity snapshots
- `getLiquidity(symbol?, limit?)` - Get liquidity documents

**Positions API** (`positionsApi.ts`):

- `createPosition(position)` - Create a new trading position
- `getPositions(symbol?, limit?)` - Get position documents
- `updatePosition(positionId, updates)` - Update a position with any fields (adjustments, stop loss, take profits, status, etc.)

All API functions are re-exported from `api/index.ts` for convenient imports:

```typescript
import { submitAnalysis, getAnalysis } from './api';
```

### Analysis Modules

- **Liquidations** - Monitors and analyzes liquidation events
- **Order Book** - Tracks order book depth and liquidity
- **Funding Rate** - Analyzes funding rate trends
- **Trend Regime** - Determines market trend direction
- **Volatility** - Measures market volatility
- **RSI/Volume/Trend** - Combined technical indicators

### Trading Engine

- Real-time position monitoring
- Automated entry/exit execution
- Stop-loss and take-profit management
- Trailing stop functionality
- Risk management and position sizing

## Notes

- Make sure the server is running before starting the trader-bot
- The bot requires an active MongoDB connection for watching coin config changes
- All trading data (analysis, positions, liquidations, liquidity) is now stored via the server API
- Telegram notifications are optional but recommended for monitoring trading activity

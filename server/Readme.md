# Crypto Trader Bot - Server

This is the backend server for the Crypto Trader Bot application built with Node.js, Express, and MongoDB.

## Features

- RESTful API with Express.js
- MongoDB integration with Mongoose
- Environment-based configuration
- Logging system
- CORS support
- Graceful shutdown handling

## Prerequisites

- Node.js (v14 or higher)
- MongoDB (local installation or MongoDB Atlas)
- npm or yarn

## Installation

1. Install dependencies:

```bash
npm install
```

2. Set up MongoDB:
   - For local MongoDB: Make sure MongoDB is running on your machine
   - For MongoDB Atlas: Create a cluster and get the connection string

## Environment Setup

Create a `.env` file in the server root directory with the following configuration:

```env
# Server Configuration
PORT=5000
NODE_ENV=development

# MongoDB Configuration
MONGODB_URI=mongodb://localhost:27017/crypto-trader-bot
MONGODB_DB_NAME=crypto-trader-bot

# MongoDB Connection Options (optional)
MONGODB_MAX_POOL_SIZE=10
MONGODB_SERVER_SELECTION_TIMEOUT=5000
MONGODB_SOCKET_TIMEOUT=45000
MONGODB_CONNECT_TIMEOUT=10000
```

### Environment Variables Description:

- `PORT`: Server port (default: 5000)
- `NODE_ENV`: Environment mode (development/production)
- `MONGODB_URI`: MongoDB connection string
- `MONGODB_DB_NAME`: Database name
- `MONGODB_MAX_POOL_SIZE`: Maximum number of connections in the pool
- `MONGODB_SERVER_SELECTION_TIMEOUT`: Server selection timeout in ms
- `MONGODB_SOCKET_TIMEOUT`: Socket timeout in ms
- `MONGODB_CONNECT_TIMEOUT`: Connection timeout in ms

## Running the Server

### Development mode:

```bash
npm run dev
```

### Production mode:

```bash
npm start
```

## Database Connection

The server automatically connects to MongoDB on startup using the configuration from environment variables. The database connection includes:

- Connection pooling
- Automatic reconnection
- Graceful shutdown handling
- Connection status monitoring
- Error logging

## API Endpoints

The server uses a modular routing system. All routes are defined in the `src/routes/` directory.

### Account Endpoints

- **GET** `/account` - Get account information

### Analytics Endpoints

- **POST** `/analytics` - Save an analysis document
  - Body: Analysis document object

- **GET** `/analytics` - Get analysis documents
  - Query params: `symbol` (optional), `limit` (optional, default: 100)

- **GET** `/analytics/history` - Get analysis data by date range and symbol
  - Query params: `symbol` (required), `dateFrom` (required), `dateTo` (required)

### Positions Endpoints

- **POST** `/positions` - Save a position document
  - Body: Position document object

- **GET** `/positions` - Get position documents
  - Query params: `symbol` (optional), `limit` (optional, default: 100)

- **PATCH** `/positions/:id` - Update a position by ID
  - Body: Any position fields to update (e.g., `{ adjustments, stopPrice, takeProfits, status, closedAt, closedBy, finalPnl, size, fees }`)

- **GET** `/positions/history` - Get closed positions history
  - Query params: `symbol` (optional), `dateFrom` (required), `dateTo` (required)

- **POST** `/positions/close` - Close a position
  - Body: `{ symbol: string }`

### Liquidations Endpoints

- **POST** `/liquidations` - Save a liquidations document
  - Body: Liquidations document object

- **GET** `/liquidations` - Get liquidations documents
  - Query params: `symbol` (optional), `limit` (optional, default: 100)

### Liquidity Endpoints

- **POST** `/liquidity` - Save a liquidity document
  - Body: Liquidity document object

- **GET** `/liquidity` - Get liquidity documents
  - Query params: `symbol` (optional), `limit` (optional, default: 100)

### Coin Config Endpoints

- **GET** `/coinconfig` - Get all coin configurations
- **GET** `/coinconfig/:symbol` - Get specific coin configuration
- **POST** `/coinconfig` - Create new coin configuration
- **PUT** `/coinconfig/:symbol` - Update coin configuration
- **DELETE** `/coinconfig/:symbol` - Delete coin configuration

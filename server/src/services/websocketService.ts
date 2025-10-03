import { Server } from 'http';
import { WebSocket, WebSocketServer } from 'ws';
import type { OutgoingMessage } from '../types/index.js';
import logger from '../utils/Logger.js';

type ConnectionHandler = (ws: WebSocket) => void;

export class WebSocketService {
  private clients: Set<WebSocket> = new Set();
  private connectionHandlers: ConnectionHandler[] = [];

  constructor(server: Server) {
    const wss = new WebSocketServer({ server });

    wss.on('connection', (ws: WebSocket) => {
      this.clients.add(ws);

      // Notify all registered connection handlers
      this.connectionHandlers.forEach((handler) => handler(ws));

      ws.on('close', () => {
        this.clients.delete(ws);
      });

      ws.on('error', () => {
        this.clients.delete(ws);
      });
    });

    logger.info('WebSocket server initialized');
  }

  // Register a handler for new connections
  onConnection(handler: ConnectionHandler): void {
    this.connectionHandlers.push(handler);
  }

  // Generic broadcast method
  broadcast(message: OutgoingMessage): void {
    const messageStr = JSON.stringify(message);

    this.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(messageStr);
      }
    });
  }

  // Send message to specific client
  sendToClient(ws: WebSocket, message: OutgoingMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  getClientCount(): number {
    return this.clients.size;
  }
}

import net from 'net';
import { logger } from '../lib/logger';
import { env } from '../lib/env';
import { extractMessages, parseMessage } from './sinotrackParser';
import { writeLocation } from './supabaseWriter';

const connections = new Map<string, net.Socket>();

/**
 * Start the SinoTrack TCP server.
 * Call this from index.ts after the Express server starts.
 */
export function startTrackingServer(): net.Server {
  const port = env.SINOTRACK_TCP_PORT;
  const maxConnections = env.SINOTRACK_MAX_CONNECTIONS;

  const server = net.createServer((socket) => {
    const clientId = `${socket.remoteAddress}:${socket.remotePort}`;

    if (connections.size >= maxConnections) {
      logger.warn({ clientId }, 'SinoTrack: max connections reached, rejecting');
      socket.destroy();
      return;
    }

    connections.set(clientId, socket);
    logger.info({ clientId, total: connections.size }, 'SinoTrack: device connected');

    socket.setEncoding('ascii');
    socket.setTimeout(5 * 60 * 1000); // 5 min idle timeout

    let buffer = '';

    socket.on('data', (data: string) => {
      buffer += data;

      const { messages, remainder } = extractMessages(buffer);
      buffer = remainder;

      for (const raw of messages) {
        const parsed = parseMessage(raw);
        if (parsed) {
          writeLocation(parsed).catch((err) => {
            logger.error({ err, raw }, 'SinoTrack: async write failed');
          });
        }
      }
    });

    socket.on('timeout', () => {
      logger.info({ clientId }, 'SinoTrack: socket idle timeout, closing');
      socket.destroy();
    });

    socket.on('error', (err) => {
      logger.warn({ err, clientId }, 'SinoTrack: socket error');
    });

    socket.on('close', () => {
      connections.delete(clientId);
      logger.info({ clientId, total: connections.size }, 'SinoTrack: device disconnected');
    });
  });

  server.on('error', (err) => {
    logger.error({ err }, 'SinoTrack: TCP server error');
  });

  server.listen(port, () => {
    logger.info({ port }, 'SinoTrack: TCP tracking server listening');
  });

  return server;
}

/**
 * Gracefully shut down the TCP server.
 */
export function stopTrackingServer(server: net.Server): Promise<void> {
  return new Promise((resolve) => {
    for (const [clientId, socket] of connections) {
      logger.info({ clientId }, 'SinoTrack: closing connection');
      socket.destroy();
    }
    connections.clear();

    server.close(() => {
      logger.info('SinoTrack: TCP server stopped');
      resolve();
    });
  });
}

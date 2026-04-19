import app from './app';
import { logger } from './lib/logger';
import { startTrackingServer, stopTrackingServer } from './tracking/tcpServer';

const port = process.env.PORT || 3001;

const server = app.listen(port, () => {
  logger.info(`Server is running at http://localhost:${port}`);
});

// Start SinoTrack TCP server on separate port
const trackingServer = startTrackingServer();

// Tune for deployment behind load balancers (ALB, Nginx) — their idle timeout
// is typically 60s, so the Node server must hold sockets longer to avoid 502s.
server.keepAliveTimeout = 65_000;
server.headersTimeout = 66_000;

let shuttingDown = false;

function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info(`Received ${signal}. Shutting down gracefully...`);

  // Stop both servers
  stopTrackingServer(trackingServer);

  server.close(() => {
    logger.info('Server closed.');
    process.exit(0);
  });

  // Force-exit after 10s if lingering connections block close()
  setTimeout(() => {
    logger.error('Forced shutdown after 10s timeout');
    process.exit(1);
  }, 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Catch errors that bypass Express' error handler (async ticks, native callbacks)
process.on('unhandledRejection', (reason) => {
  logger.error({ reason }, 'Unhandled promise rejection');
  // Do not exit on unhandledRejection in production — log and keep serving.
});

process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'Uncaught exception — process unstable, exiting');
  shutdown('uncaughtException');
});

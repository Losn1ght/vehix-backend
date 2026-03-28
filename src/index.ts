import app from './app';
import { logger } from './lib/logger';

const port = process.env.PORT || 3001;

const server = app.listen(port, () => {
  logger.info(`Server is running at http://localhost:${port}`);
});

// Graceful shutdown
function shutdown() {
  logger.info('Shutting down gracefully...');
  server.close(() => {
    logger.info('Server closed.');
    process.exit(0);
  });
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

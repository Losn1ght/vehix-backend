import cluster from 'node:cluster';
import os from 'node:os';
import { logger } from './lib/logger';

const numWorkers = Math.min(os.cpus().length, 4); // Cap at 4 workers

if (cluster.isPrimary) {
  logger.info(`Primary process ${process.pid} starting ${numWorkers} workers`);

  for (let i = 0; i < numWorkers; i++) {
    cluster.fork();
  }

  cluster.on('exit', (worker, code) => {
    logger.warn(`Worker ${worker.process.pid} exited (code ${code}). Restarting...`);
    cluster.fork();
  });
} else {
  // Worker process — start the server
  require('./index');
}

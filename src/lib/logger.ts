type LogLevel = 'info' | 'warn' | 'error';

function formatLog(level: LogLevel, message: string): string {
  return `[${new Date().toISOString()}] [${level.toUpperCase()}] ${message}`;
}

export const logger = {
  info: (msg: string) => process.stdout.write(formatLog('info', msg) + '\n'),
  warn: (msg: string) => process.stdout.write(formatLog('warn', msg) + '\n'),
  error: (msg: string) => process.stderr.write(formatLog('error', msg) + '\n'),
};

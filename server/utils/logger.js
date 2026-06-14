/* eslint-disable no-console */
/**
 * Logger utility to output formatted console messages with UTC timestamps
 */
const getTimestamp = () => new Date().toISOString();

export const logger = {
  log: (message, ...args) => {
    console.log(`[${getTimestamp()}] LOG:`, message, ...args);
  },
  info: (message, ...args) => {
    console.info(`[${getTimestamp()}] INFO:`, message, ...args);
  },
  warn: (message, ...args) => {
    console.warn(`[${getTimestamp()}] WARN:`, message, ...args);
  },
  error: (message, ...args) => {
    console.error(`[${getTimestamp()}] ERROR:`, message, ...args);
  }
};

export default logger;

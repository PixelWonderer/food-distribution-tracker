/**
 * Dev-only logger. In production builds, debug/info calls are no-ops.
 * warn and error always log (they indicate real problems).
 */
const isDev = import.meta.env.DEV;

const noop = () => {};

export const logger = {
  /** Debug info visible only in development */
  debug: isDev ? console.log.bind(console) : noop,
  /** Informational messages visible only in development */
  info: isDev ? console.log.bind(console) : noop,
  /** Warnings — always visible */
  warn: console.warn.bind(console),
  /** Errors — always visible */
  error: console.error.bind(console),
} as const;

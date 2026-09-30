export const logger = {
  log: (...args: unknown[]) => {
    console.log(new Date().toISOString(), ...args);
  },
  error: (...args: unknown[]) => {
    console.error(new Date().toISOString(), ...args);
  },

  info: (...args: unknown[]) => {
    console.info(...args);
  },
  warn: (...args: unknown[]) => {
    console.warn(...args);
  },
  debug: (...args: unknown[]) => {
    console.debug(...args);
  },
};

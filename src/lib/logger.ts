export const logger = {
  log: (...args: any[]) => {
    console.log(new Date().toISOString(), ...args);
  },
  error: (...args: any[]) => {
    console.error(new Date().toISOString(), ...args);
  },

  info: (...args: any[]) => {
    console.info(...args);
  },
  warn: (...args: any[]) => {
    console.warn(...args);
  },
  debug: (...args: any[]) => {
    console.debug(...args);
  },
};

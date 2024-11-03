export const logger = {
    log: (...args: any[]) => {
      console.log(new Date().toISOString(), ...args);
    },
    error: (...args: any[]) => {
      console.error(new Date().toISOString(), ...args);
    }
  };
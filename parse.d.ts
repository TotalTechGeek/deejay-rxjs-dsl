/**
  * Parses the instructions and attempts to provide decent feedback if it fails.
  * @param {string} script
  * @param {{ startRule: string }} options
  */
export function parse(script: string, { startRule }: {
    startRule: string;
}): any;

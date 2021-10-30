declare namespace _default {
    export { dsl };
    export { generateCompiledLogic };
    export { engine };
    export { generateLogic };
}
export default _default;
/**
 * Takes in the instructions from the dsl and generates functions to be used
 * in an RxJS pipeline.
 *
 * @param {string} str
 * @returns {((...args) => any)[] | (...args) => any}
 */
export function dsl(str: string, mode?: number): ((...args: any[]) => any)[] | ((...args: any[]) => any);
export function generateCompiledLogic(str: any): any;
import { engine } from "./engine.js";
export function generateLogic(str: any): any;
export { engine };

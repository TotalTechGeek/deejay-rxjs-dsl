declare namespace _default {
    export { dsl };
    export { generateLogic };
}
export default _default;
/**
 * Takes in the instructions from the dsl and generates functions to be used
 * in an RxJS pipeline.
 *
 * @param {string} str
 * @param {{ engine?: import('json-logic-engine').LogicEngine, substitutions?: any, additionalOperators?: any, mode?: number }} options
 * @returns {((...args) => any)[] | (...args) => any}
 */
export function dsl(str: string, { mode, substitutions, engine, additionalOperators }?: {
    engine?: import('json-logic-engine').LogicEngine;
    asyncEngine?: import('json-logic-engine').AsyncLogicEngine;
    substitutions?: any;
    additionalOperators?: any;
    mode?: number;
}): ((...args: any[]) => any)[] | ((...args: any[]) => any);
export function generateLogic(str: any): any;

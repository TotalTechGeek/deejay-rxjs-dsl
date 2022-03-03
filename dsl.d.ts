/**
 * Takes in the instructions from the dsl and generates functions to be used
 * in an RxJS pipeline.
 *
 * @param {string} str
 * @param {{ engine?: import('json-logic-engine').LogicEngine, asyncEngine?: import('json-logic-engine').AsyncLogicEngine, substitutions?: any, additionalOperators?: any, mode?: number }} options
 * @returns {((...args) => any)[]}
 */
export function dsl(str: string, { substitutions, engine, asyncEngine, additionalOperators }?: {
    engine?: import('json-logic-engine').LogicEngine;
    asyncEngine?: import('json-logic-engine').AsyncLogicEngine;
    substitutions?: any;
    additionalOperators?: any;
    mode?: number;
}): ((...args: any[]) => any)[];
/**
 * Parses a string into a JSON-Logic program.
 * @param {string} str
 */
export function generateLogic(str: string): any;
/**
 * Adds a method that allows you to parse the DSL Script into the JSON Document.
 * @param {string} str
 * @returns {({ expressions: any[], operator: string } | { split: any[] } | { fork: any[] })[]}
 */
export function generatePipeline(str: string): ({
    expressions: any[];
    operator: string;
} | {
    split: any[];
} | {
    fork: any[];
})[];
declare namespace _default {
    export { dsl };
    export { generateLogic };
    export { generatePipeline };
}
export default _default;

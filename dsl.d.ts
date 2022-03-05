/**
 * Declares an operator's configuration to the DSL. Used to specify how the operator should be built.
 * "immediateFrom" decides which expressions are parsed as functions to be invoked, or as the computed result,
 * "context" decides whether the operator use "$.accumulator" and "$.current" instead of "@",
 * "defaults" can fill in default values for the operator's parameters.
 * @param {(...args: any[]) => ((source: any) => import('rxjs').Observable<any>) | import('rxjs').OperatorFunction<any, any> | import('rxjs').MonoTypeOperatorFunction<any> } operator
 * @param {{ immediateFrom?: number, context?: boolean, defaults?: any[], parseDefaults?: boolean, defaultStart?: number }} [options]
 * @param {boolean} [inject] Decides whether this should be injected into a DSL-wide configuration, or wrap the operator. If you are outside of the scope of the module, you might use false.
 */
export function declare(operator: (...args: any[]) => import("rxjs").OperatorFunction<any, any> | import("rxjs").MonoTypeOperatorFunction<any> | ((source: any) => import('rxjs').Observable<any>), { immediateFrom, context, defaults, parseDefaults, defaultStart }?: {
    immediateFrom?: number;
    context?: boolean;
    defaults?: any[];
    parseDefaults?: boolean;
    defaultStart?: number;
}, inject?: boolean): {
    operator: (...args: any[]) => import("rxjs").OperatorFunction<any, any> | import("rxjs").MonoTypeOperatorFunction<any> | ((source: any) => import('rxjs').Observable<any>);
    configuration: {
        immediateFrom: number;
        context: boolean;
        defaults: any[];
        defaultStart: number;
    };
};
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
    export { declare };
}
export default _default;

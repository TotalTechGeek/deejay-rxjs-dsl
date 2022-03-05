declare namespace _default {
    export { setupEngine };
}
export default _default;
/**
 * The logic engine you wish to set up.
 */
export function setupEngine(engine: import('json-logic-engine').AsyncLogicEngine): import("json-logic-engine/asyncLogic").default;
/**
 * The logic engine you wish to set up.
 */
export function setupEngine(engine: import('json-logic-engine').LogicEngine): import("json-logic-engine/logic").default;

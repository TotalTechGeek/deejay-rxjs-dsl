declare namespace _default {
    export { createReducer };
}
export default _default;
export function createReducer(maxLength?: number, intervals?: number[], warn?: boolean): (obj: any, { x, y }: {
    x: any;
    y: any;
}, size?: number) => any;

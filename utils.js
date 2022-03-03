/**
 * Adapts an operator so that the first argument is evaluated.
 * This is useful for operators that only need to eval the first
 * argument on creation (and not each time the operator is called).
 *
 * @param func
 * @returns
 */
export function adapt (func) {
  return function (...args) {
    args[0] = args[0]()
    return func(...args)
  }
}

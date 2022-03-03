export function adapt (func) {
  return function (...args) {
    args[0] = args[0]()
    return func(...args)
  }
}

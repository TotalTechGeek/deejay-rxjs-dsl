import { mutateTraverse } from '../../mutateTraverse.js'

/**
 * Allows us to use `var` instead of `context` in some of the virtual reducers,
 * while also allowing us to use `context` if we wish, without it getting messed up.
 * @param {*} logic
 * @returns
 */
export const mutateLogic = (logic) => {
  let needsMutated = true
  mutateTraverse(logic, i => {
    if (i.context && i.context.startsWith('current')) needsMutated = false
    return i
  })

  if (needsMutated) {
    return mutateTraverse(logic, i => {
      if (typeof i.val !== 'undefined') {
        if (!i.val) return { context: 'current' }
        if (Array.isArray(i.val)) return { context: ['current', ...i.val] }
        return { context: ['current', i.val] }
      }
      return i
    })
  }
  return logic
}

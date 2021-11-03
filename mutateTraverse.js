export function mutateTraverse (obj, mut = i => i) {
  if (!obj) { return obj }
  for (const key in obj) {
    if (typeof obj[key] === 'object') {
      obj[key] = mutateTraverse(obj[key], mut)
    }
  }
  return mut(obj)
}

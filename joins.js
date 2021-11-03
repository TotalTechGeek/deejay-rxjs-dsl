export function ijoin (...args) {
  const tableCount = Math.ceil(args.length / 2)

  if (args.length - tableCount !== tableCount - 1) {
    throw new Error('Not enough join clauses')
  }

  const tables = args.slice(0, tableCount)
  const joins = args.slice(tableCount)

  let cur = tables.shift()

  while (tables.length) {
    const comped = tables.shift()
    const join = joins.shift()

    cur = cur.flatMap(i => comped.map(j => {
      if (join([i, j])) { return { ...i, ...j } }
      return null
    }).filter(i => i))
  }

  return cur
}

export function kjoin (...args) {
  const tableCount = Math.ceil(args.length / 2)

  if (args.length - tableCount !== tableCount - 1) {
    throw new Error('Not enough join clauses')
  }

  const tables = args.slice(0, tableCount)
  const joins = args.slice(tableCount)

  let cur = tables.shift()

  while (tables.length) {
    const [a, b] = joins.shift()

    const comped = tables.shift().reduce((acc, value) => {
      acc[value[b]] = acc[value[b]] || []
      acc[value[b]].push(value)
      return acc
    }, {}) // ?

    cur = cur.flatMap(i => {
      if (comped[i[a]]) {
        return comped[i[a]].map(j => ({ ...i, ...j })).filter(i => i)
      }
      return []
    })
  }

  return cur
}

import { mutateLogic } from './replacer.js'

export const average = (logic) => {
  logic = mutateLogic(logic)

  const total = { '+': [{ context: 'accumulator.total' }, logic] }
  const count = { '+': [{ context: 'accumulator.count' }, 1] }

  return [
    ['reduce', { obj: ['total', total, 'count', count] }, ['{}']],
    ['map', { '/': [{ var: 'total' }, { var: 'count' }] }, []]
  ]
}

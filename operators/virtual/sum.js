import { mutateLogic } from './replacer.js'

export const sum = (logic) => {
  logic = mutateLogic(logic)
  return [['reduce', { '+': [{ context: 'accumulator' }, logic] }, 0]]
}

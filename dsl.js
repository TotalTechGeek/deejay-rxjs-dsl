
import * as operators from 'rxjs/operators'
import { engine } from './engine.js'

// A not so great implementation of a formula parser.
// I could've gone with an OTS library that supported this functionality, but to eliminate dependencies I just wanted to quickly throw something together.
const priorities = [['||'], ['&&'], ['!==', '!=', '===', '=='], ['<=', '<', '>', '>='], ['+', '-'], ['%'], ['*', '/'], ['**'], ['!']].reverse()
const allOperators = priorities.reduce((a, b) => a.concat(b), [])
const unary = new Set(['!'])
const operatorFunctions = {
  '!': 'not',
  '+': 'add',
  '*': 'mul',
  '**': 'exp',
  '-': 'sub',
  '/': 'div',
  '%': 'mod',
  '||': 'or',
  '&&': 'and',
  '<': 'lt',
  '<=': 'lte',
  '>': 'gt',
  '>=': 'gte',
  '!=': 'ne',
  '==': 'eq',
  '===': 'eeq',
  '!==': 'neeq'
}
function _mutateTraverse (obj, mut = i => i) {
  if (!obj) { return obj }
  for (const key in obj) {
    if (typeof obj[key] === 'object') {
      obj[key] = _mutateTraverse(obj[key], mut)
    }
  }
  return mut(obj)
}
function invert (obj) {
  const result = {}
  for (const key in obj) {
    result[obj[key]] = key
  }
  return result
}
const logicalOps = invert(operatorFunctions)
logicalOps.or = 'or'
logicalOps.and = 'and'
logicalOps.In = 'in'
/**
 *
 * @param {string} str
 */
function replace (str) {
  let cur = ''
  let p = ''
  let count = 0
  for (let i = 0; i < str.length; i++) {
    if (str[i] === '(') { count++ }
    if (str[i] === ')') {
      count--
      if (!count) {
        cur += `(${replace(p.substring(1))})`
        p = ''
        continue
      }
    }
    if (!count) {
      cur += str[i]
    } else {
      p += str[i]
    }
  }
  str = cur
  str = str.replace(/ /g, '')
  for (const operators of priorities) {
    let arr = operators.map(i => [i, str.indexOf(i)]).filter(i => i[1] !== -1).sort((a, b) => a[1] - b[1])
    const matching = allOperators.filter(i => arr.find(a => i !== a[0] && i.startsWith(a[0])))
    while (arr.length) {
      // console.log(str)
      const [operator, index] = arr.shift()
      if (matching.find(match => {
        if (operator === match) { return false }
        return str.indexOf(match) === index
      })) { continue }
      let prevIndex = index
      let parenthCount = 0
      while (prevIndex >= 0 && /[$@.A-Za-z0-9_()^,'"#]/.exec(str[prevIndex - 1])) {
        if (str[prevIndex - 1] === ')') { parenthCount++ } else if (str[prevIndex - 1] === '(') { parenthCount-- } else if (str[prevIndex - 1] === ',') {
          if (!parenthCount) { break }
        }
        prevIndex--
      }
      parenthCount = 0
      let nextIndex = index + operator.length
      while (nextIndex < str.length + 1 && /[$@.A-Za-z0-9_()^,'"#]/.exec(str[nextIndex + 1])) {
        if (str[nextIndex + 1] === '(') { parenthCount++ } else if (str[nextIndex + 1] === ')') { parenthCount-- } else if (str[nextIndex + 1] === ',') {
          if (!parenthCount) { break }
        }
        nextIndex++
      }
      const after = str.substring(index + operator.length, nextIndex + 1)
      if (unary.has(operator)) {
        const replaceWith = `${operatorFunctions[operator]}(${after})` // ?
        str = str.substring(0, index) + replaceWith + str.substring(nextIndex + 1)
      } else {
        const before = str.substring(prevIndex, index)
        const replaceWith = `${operatorFunctions[operator]}(${before},${after})` // ?
        str = str.substring(0, prevIndex) + replaceWith + str.substring(nextIndex + 1)
      }
      arr = operators.map(i => [i, str.indexOf(i)]).filter(i => i[1] !== -1).sort((a, b) => a[1] - b[1])
    }
  }
  // console.log(str)
  return str
}
function splitOutsideParenthesis (str, splitter = ',') {
  const result = []
  let cur = ''
  let parenth = 0
  let quoteMode = false
  for (let i = 0; i < str.length; i++) {
    // does not account for \"
    if (!quoteMode) {
      if (str[i] === '"') { quoteMode = '"' }
      if (str[i] === "'") { quoteMode = "'" }
      if (str[i] === '(') { parenth++ }
      if (str[i] === ')') { parenth-- }
    } else {
      if (str[i] === '"' && quoteMode === '"') { quoteMode = false }
      if (str[i] === "'" && quoteMode === "'") { quoteMode = false }
    }
    if (str[i] === splitter && !parenth && !quoteMode) {
      result.push(cur)
      cur = ''
    } else {
      cur += str[i]
    }
  }
  result.push(cur)
  return result
}
/**
 *
 * @param {string} str
 */
function toLogic (str, strings) {
  if (/^[0-9.]+$/g.exec(str)) {
    return Number(str)
  }
  if (str.indexOf('(') !== -1) {
    if (!str.endsWith(')')) {
      const toRemoveEnd = str.split('.')
      const end = toRemoveEnd.pop()
      const start = toRemoveEnd.join('.')
      str = `get(${start},${JSON.stringify(end)})`
    }
    const [head, ...tail] = str.split('(')
    let rest = tail.join('(')
    rest = rest.substring(0, rest.length - 1)
    if (!head) {
      return toLogic(rest, strings)
    }
    const operands = splitOutsideParenthesis(rest)
    if (operands.length > 1) {
      return { [logicalOps[head] || head]: operands.map(i => toLogic(i, strings)) }
    }
    return { [logicalOps[head] || head]: toLogic(operands[0], strings) }
  }
  if (str.startsWith('@.')) {
    return { var: str.replace(/\^\./g, '^').replace(/\.\^/g, '.../').substring(2) }
  } else if (str === '@') {
    return { var: '' }
  }
  if (str.startsWith('$.')) {
    return { context: str.substring(2) }
  } else if (str === '$') {
    return { context: '' }
  }
  if (str === 'true' || str === 'false') {
    return str === 'true'
  }
  if ((str.startsWith('\'') && str.endsWith('\'')) || (str.startsWith('"') && str.endsWith('"'))) {
    return str.substring(1, str.length - 1)
  }
  if (str.startsWith('#')) {
    return strings[+str.substring(1)]
  }
  if (str === 'null') {
    return null
  }
  if (!str || str === 'undefined') {
    return undefined
  }
  throw new Error(`Not a valid query: ${str}`)
}
/**
 * Simple mechanism for removing the string variables.
 * @param {string} str
 */
function removeStrings (str) {
  const strings = []
  let cur = ''
  let quoteMode = 0
  let backslash = false
  for (let i = 0; i < str.length; i++) {
    if (!backslash && str[i] === '"') {
      if (quoteMode === 1) {
        quoteMode = 0
      } else if (!quoteMode) {
        cur += '#' + strings.length
        strings.push('')
        quoteMode = 1
      } else {
        strings[strings.length - 1] += str[i]
      }
    } else if (!backslash && str[i] === "'") {
      if (quoteMode === 2) {
        quoteMode = 0
      } else if (!quoteMode) {
        cur += '#' + strings.length
        strings.push('')
        quoteMode = 2
      } else {
        strings[strings.length - 1] += str[i]
      }
    } else if (str[i] === '\\') {
      backslash = true
    } else if (quoteMode) {
      backslash = false
      strings[strings.length - 1] += str[i]
    } else {
      backslash = false
      cur += str[i]
    }
  }
  return { text: cur, strings }
}

function generateLogic (str) {
  const expr = /^[A-Za-z0-9, $@.!*<=>|$:_^(){}&'"-/?[\]%+\\]+$/
  if (expr.exec(str)) {
    const query = str.substring(0, str.length) // ?
    const { text, strings } = removeStrings(query)
    return toLogic(replace(text), strings)
  } else {
    throw new Error(`Not a valid query: ${str}`)
  }
}
const accumulators = new Set(['reduce', 'scan', 'mergeScan', 'switchScan'])
const fixedOperators = new Set(['take', 'takeLast', 'skip', 'pluck', 'debounceTime', 'throttleTime', 'timeout', 'bufferCount'])
/**
 * @param {keyof typeof operators} name
 * @param {*} logic
 * @param {number} n
 * @returns {Function}
 */
function buildOperator (name, logic, { n = 1, eval: evaluate = false, extra = [] } = {}) {
  const operator = operators[name]
  if (n === 1) {
    if (accumulators.has(name)) {
      _mutateTraverse(logic, i => {
        if (typeof i.var !== 'undefined') {
          throw new Error('Do not use the typical "@" operator in a reducer. Use $.current and $.accumulator.')
        }
        if (typeof i.context !== 'undefined') {
          return { var: i.context }
        }
        return i
      })
      const f = engine.build(logic)
      return operator((...args) => f({ accumulator: args[0], current: args[1] }), ...extra)
    }
    let f = engine.build(logic)
    if (evaluate || fixedOperators.has(name)) { f = f() }
    return operator(f, ...extra)
  }
  let f = engine.build(logic)
  if (evaluate) { f = f() }
  return operator((...args) => f(args), ...extra)
}
function generateCompiledLogic (str) {
  const logic = generateLogic(str)
  // console.log(logic)
  return engine.build(logic)
}
/**
 * Takes in the instructions from the dsl and generates functions to be used
 * in an RxJS pipeline.
 *
 * @param {string} str
 * @returns {((...args) => any)[] | (...args) => any}
 */
function dsl (str, mode = 0) {
  if (str.indexOf('\n') !== -1 || str.indexOf(';') !== -1) {
    return str.split(/\n|;/).filter(i => i.trim()).map(i => dsl(i, 0))
  }
  str = str.trim()
  if (str.startsWith('!')) {
    return dsl(str.substring(1), 1)
  }
  if (str.startsWith('#')) {
    return dsl(str.substring(1), 2)
  }
  const [head, ...tail] = str.split(' ')
  const rest = tail.join(' ')
  const [expression, ...extra] = splitOutsideParenthesis(rest).map(i => i.trim())
  const logic = generateLogic(expression)
  // console.log(JSON.stringify({ [head]: logic }))
  return buildOperator(head, logic, { n: mode === 1 ? 2 : 1, eval: mode === 2, extra: extra.map(JSON.parse) })
}
export { dsl }
export { generateCompiledLogic }
export { engine }
export { generateLogic }
export default {
  dsl,
  generateCompiledLogic,
  engine,
  generateLogic
}


import rxOps from 'rxjs/operators'
import { engine } from './engine.js'
import { mutateTraverse } from './mutateTraverse.js'
import { bufferReduce } from './operators/bufferReduce.js'
import { throttleReduce } from './operators/throttleReduce.js'
import { average } from './operators/virtual/average.js'
import { sum } from './operators/virtual/sum.js'

const operators = { ...rxOps, throttleReduce, bufferReduce }
const virtualOperators = { sum, average }

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

function objectPrepass (str) {
  let objCount = 0
  let result = ''

  let tokenStart = -1
  let tokenEnd = -1

  for (let i = 0; i < str.length; i++) {
    if (str[i] === '{') {
      objCount++
      result += 'obj('
      continue
    }

    if (str[i] === '}') {
      objCount--
      result += ')'
      continue
    }

    if (objCount) {
      if (str[i] === ':') {
        if (tokenStart !== -1) {
          result = result.substring(0, tokenStart) + `"${result.substring(tokenStart, tokenEnd + 1)}"` + result.substring(tokenEnd + 1)
        }
        result += ','
        tokenStart = -1
        continue
      }
    }

    result += str[i]

    // if letter is A-Z or a-z
    if (objCount && str[i].match(/[A-Za-z0-9_]/)) {
      if (tokenStart === -1 && (str[i - 1] === ' ' || str[i - 1] === '{' || str[i - 1] === ',')) { tokenStart = result.length - 1 }
      tokenEnd = result.length - 1
    } else {
      tokenStart = -1
    }
  }

  return result
}

function listPrepass (str) {
  let result = ''
  for (let i = 0; i < str.length; i++) {
    if (str[i] === '[') {
      result += 'list('
      continue
    }
    if (str[i] === ']') {
      result += ')'
      continue
    }
    result += str[i]
  }
  return result
}

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
      if (str[nextIndex] === '(') parenthCount++
      while (nextIndex < str.length + 1 && /[$@.A-Za-z0-9_()^,'"#]/.exec(str[nextIndex + 1])) {
        if (str[nextIndex + 1] === '(') {
          parenthCount++
        } else if (str[nextIndex + 1] === ')') {
          parenthCount--
        } else if (str[nextIndex + 1] === ',') {
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
  return str
}
function splitOutsideParenthesis (str, splitters = ',', check = false) {
  if (!Array.isArray(splitters)) splitters = [splitters]
  if (!splitters.length) throw new Error('No delimiters specified')

  splitters = splitters.map(i => {
    return {
      text: i.text || i,
      keep: i.keep || false,
      next: i.next || false
    }
  })

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

    const splitter = splitters.find(splitter => str.substr(i, splitter.text.length) === splitter.text)
    if (splitter && !parenth && !quoteMode) {
      if (check) return true
      result.push(cur)
      cur = ''
      i += splitter.text.length - 1
      if (splitter.keep) {
        if (splitter.next) {
          cur += splitter.text
        } else {
          result[result.length - 1] += splitter.text
        }
      }
      continue
    }

    cur += str[i]
  }
  result.push(cur)

  if (check) return false
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
    return { var: str.replace(/\^\./g, '^').replace(/\^/g, '../').substring(2) }
  }

  if (str === '@') {
    return { var: '' }
  }

  if (str === '@group') {
    return { '@group': '' }
  }

  if (str.startsWith('$.')) {
    return { context: str.substring(2) }
  }

  if (str === '$') {
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

  if (str === 'Infinity') {
    return Infinity
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
  const expr = /^[A-Za-z0-9, $@.!*<=>|$:_^();{}&'"-/?[\]%+\\]+$/
  if (expr.exec(str)) {
    const query = str.substring(0, str.length) // ?
    let { text, strings } = removeStrings(query)

    text = listPrepass(objectPrepass(text))

    return toLogic(replace(text), strings)
  } else {
    throw new Error(`Not a valid query: ${str}`)
  }
}
const accumulators = new Set(['reduce', 'scan', 'mergeScan', 'switchScan', 'throttleReduce', 'bufferReduce'])
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
      mutateTraverse(logic, i => {
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
function dsl (str, mode = 0, substitutions = {}) {
  if (splitOutsideParenthesis(str, ['\n', ';', { text: '>>', keep: true }, { text: '<<', keep: true, next: true }], true)) {
    const result = []
    const lines = splitOutsideParenthesis(str, ['\n', ';', { text: '>>', keep: true }, { text: '<<', keep: true, next: true }]).map(i => i.trim()).filter(i => i)

    let line = lines.shift()

    while (line) {
      if (line.endsWith('>>')) {
        result.push(...dsl(line.substring(0, line.length - 2), 0))

        let blockCount = 0
        // grab the lines
        const dslLines = [lines.shift()]

        while (!dslLines[dslLines.length - 1].startsWith('<<') || blockCount) {
          if (dslLines[dslLines.length - 1].endsWith('>>')) blockCount++
          if (dslLines[dslLines.length - 1].startsWith('<<')) blockCount--
          dslLines.push(lines.shift())
        }
        dslLines.pop()

        result.push(rxOps.map(group => {
          return group.pipe(
            ...dsl(`${dslLines.join(';')};`, 0, {
              '@group': group.key
            })
          )
        }))

        // todo: Allow other forms of merging.
        result.push(rxOps.mergeAll())
      } else {
        result.push(...dsl(line, 0, substitutions))
      }

      line = lines.shift()
    }

    return result
  }
  str = str.trim()

  if (str.startsWith('!')) {
    return dsl(str.substring(1), 1, substitutions)
  }

  if (str.startsWith('#')) {
    return dsl(str.substring(1), 2, substitutions)
  }

  const [head, ...tail] = str.split(' ')
  const rest = tail.join(' ')
  const [expression, ...extra] = splitOutsideParenthesis(rest).map(i => i.trim())

  const logic = mutateTraverse(generateLogic(expression), i => {
    if (i && typeof i === 'object') {
      for (const k in substitutions) {
        if (k in i) {
          return substitutions[k]
        }
      }
    }
    return i
  })

  let operators = [
    [head, logic, extra]
  ]

  if (virtualOperators[head]) {
    operators = virtualOperators[head](logic)
  }

  // console.log(JSON.stringify({ [head]: logic }))

  return operators.map(([head, logic, extra]) => {
    return buildOperator(head, logic, {
      n: mode === 1 ? 2 : 1,
      eval: mode === 2,
      extra: extra.map(i => {
        return engine.run(generateLogic(i))
      })
    })
  })
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

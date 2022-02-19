import * as rxOps from 'rxjs/operators'
import { merge, zip, race, concat } from 'rxjs'
import { setupEngine } from './engine.js'
import { mutateTraverse } from './mutateTraverse.js'
import { bufferReduce } from './operators/bufferReduce.js'
import { throttleReduce } from './operators/throttleReduce.js'
import { average } from './operators/virtual/average.js'
import { sum } from './operators/virtual/sum.js'
import { AsyncLogicEngine, LogicEngine } from 'json-logic-engine'
import { toObject } from './operators/virtual/toObject.js'

import { parse } from './parser/dsl.js'

import strip from 'strip-comments'
import { clone } from 'ramda'

const operators = { ...rxOps, throttleReduce, bufferReduce }
const virtualOperators = { sum, average, toObject }
const joinOperators = { merge, zip, race, concat }

const accumulators = new Set(['reduce', 'scan', 'mergeScan', 'switchScan', 'throttleReduce', 'bufferReduce'])
const fixedOperators = new Set(['take', 'takeLast', 'skip', 'pluck', 'debounceTime', 'throttleTime', 'timeout', 'bufferCount', 'windowCount', 'windowTime'])

/**
 * @param {keyof typeof operators} name
 * @param {*} logic
 * @param {number} n
 * @returns {Function}
 */
function buildOperator (name, logic, { asyncEngine, n = 1, eval: evaluate = false, extra = [], engine, ops = operators } = {}) {
  if (name === 'async') {
    const f = asyncEngine.build(logic)
    return operators.mergeMap(async (...args) => (await f)(args), ...extra)
  }

  const operator = ops[name]
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

const defaultEngine = setupEngine(new LogicEngine())
const defaultAsyncEngine = setupEngine(new AsyncLogicEngine())

function parseExpressions (operator, expressions, { substitutions, engine, asyncEngine, additionalOperators }) {
  const substitutionLogic = expression => mutateTraverse(clone(expression), i => {
    if (i && typeof i === 'object') {
      for (const k in substitutions) {
        if (k in i) {
          return substitutions[k]
        }
      }
    }
    return i
  })

  expressions = expressions.map(substitutionLogic)

  let logicOperators = [
    [operator, ...expressions]
  ]

  if (virtualOperators[operator]) {
    logicOperators = virtualOperators[operator](...expressions)
  }

  return logicOperators.map(([head, ...expressions]) => {
    const logic = expressions.shift()
    const mode = head.startsWith('!') ? 1 : head.startsWith('#') ? 2 : 0
    if (head.startsWith('#') || head.startsWith('!')) head = head.substring(1)
    return buildOperator(head, logic, {
      n: mode === 1 ? 2 : 1,
      eval: mode === 2,
      engine,
      asyncEngine,
      ops: { ...additionalOperators, ...operators },
      extra: expressions
    })
  })
}

/**
 * Takes in the instructions from the dsl and generates functions to be used
 * in an RxJS pipeline.
 * @param {*} program
 * @param {{ engine?: import('json-logic-engine').LogicEngine, asyncEngine?: import('json-logic-engine').AsyncLogicEngine, substitutions?: any, additionalOperators?: any }} options
 * @returns {((...args) => any)[]}
 */
function buildDSL (program, { substitutions, engine, asyncEngine, additionalOperators }) {
  return program.flat().flatMap(item => {
    if (item.operator) {
      // expressions
      return parseExpressions(item.operator, item.expressions || [], { substitutions, engine, asyncEngine, additionalOperators })
    } else if (item.split) {
      return [
        // use the pipeline operator map pipe the output of each incoming observable into defined pipeline.
        rxOps.map(group => {
          return group.pipe(
            ...buildDSL(item.split, {
              substitutions: {
                ...substitutions,
                '@group': group.key
              },
              engine,
              asyncEngine,
              additionalOperators
            })
          )
        }),
        // merge them in.
        rxOps.mergeAll()
      ]
    } else if (item.fork) {
      let operation = merge
      if (item.type in joinOperators) operation = joinOperators[item.type]
      return rxOps.connect(i => operation(
        ...item.fork.map(logic => {
          return i.pipe(...buildDSL(logic, { substitutions, additionalOperators, engine, asyncEngine }))
        })
      ))
    }
    throw new Error()
  })
}

/**
 * Takes in the instructions from the dsl and generates functions to be used
 * in an RxJS pipeline.
 *
 * @param {string} str
 * @param {{ engine?: import('json-logic-engine').LogicEngine, asyncEngine?: import('json-logic-engine').AsyncLogicEngine, substitutions?: any, additionalOperators?: any, mode?: number }} options
 * @returns {((...args) => any)[]}
 */
export function dsl (str, {
  substitutions = {},
  engine = defaultEngine,
  asyncEngine = defaultAsyncEngine,
  additionalOperators = {}
} = {}) {
  const program = parse(strip(str), { startRule: 'Document' })
  return buildDSL(program, { substitutions, engine, asyncEngine, additionalOperators })
}

export function generateLogic (str) {
  return parse(str, { startRule: 'Expression' })
}

export default {
  dsl,
  generateLogic
}

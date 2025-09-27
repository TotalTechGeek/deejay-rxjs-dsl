// @ts-check
import * as rxOps from 'rxjs/operators'
import { merge, zip, race, concat, pipe } from 'rxjs'
import { setupEngine } from './engine.js'
import { mutateTraverse } from './mutateTraverse.js'
import flush from './operators/flush.js'
import wrap from './operators/wrap.js'

import { bufferReduce } from './operators/bufferReduce.js'
import { throttleReduce } from './operators/throttleReduce.js'
import { average } from './operators/virtual/average.js'
import { sum } from './operators/virtual/sum.js'
import { AsyncLogicEngine, LogicEngine } from 'json-logic-engine'
import { toObject } from './operators/virtual/toObject.js'

import { clone } from 'ramda'
import { parse } from './parse.js'

const operators = { ...rxOps, throttleReduce, bufferReduce, flush, wrap }
const virtualOperators = { sum, average, toObject }
const joinOperators = { merge, zip, race, concat }

const accumulators = ['reduce', 'scan', 'mergeScan', 'switchScan', 'throttleReduce', 'bufferReduce', 'max', 'min']
const fixedOperators = ['take', 'takeLast', 'skip', 'pluck', 'debounceTime', 'throttleTime', 'timeout', 'bufferCount', 'windowCount', 'windowTime', 'toArray', 'auditTime', 'sampleTime', 'startWith', 'endWith']

const operatorDefinitions = new Map()

const fixedDefinition = { immediateFrom: 0, context: false }
const accumulatorDefinition = { immediateFrom: 1, context: true }

accumulators.forEach(operator => operatorDefinitions.set(operators[operator], accumulatorDefinition))
fixedOperators.forEach(operator => operatorDefinitions.set(operators[operator], fixedDefinition))

/**
 * Declares an operator's configuration to the DSL. Used to specify how the operator should be built.
 * "immediateFrom" decides which expressions are parsed as functions to be invoked, or as the computed result,
 * "context" decides whether the operator use "$.accumulator" and "$.current" instead of "@",
 * "defaults" can fill in default values for the operator's parameters.
 * "async" allows expressions to be built with the asyncEngine, but will be given to the operator as a Promise<Func>.
 * @param {(...args: any[]) => ((source: any) => import('rxjs').Observable<any>) | import('rxjs').OperatorFunction<any, any> | import('rxjs').MonoTypeOperatorFunction<any> } operator
 * @param {{ immediateFrom?: number, context?: boolean, defaults?: any[], parseDefaults?: boolean, defaultStart?: number, async?: boolean }} [options]
 * @param {boolean} [inject] Decides whether this should be injected into a DSL-wide configuration, or wrap the operator. If you are outside of the scope of the module, you might use false.
 */
export function declare (operator, { immediateFrom = 1, context = false, defaults = [], parseDefaults = false, defaultStart = 0, async = false } = {}, inject = true) {
  if (parseDefaults) defaults = defaults.map(generateLogic)

  if (inject) operatorDefinitions.set(operator, { immediateFrom, context, defaults, defaultStart, async })
  return {
    operator,
    configuration: { immediateFrom, context, defaults, defaultStart, async }
  }
}

// Some declarations of baked in operators
declare(flush, { immediateFrom: 0, context: false })
declare(wrap, { defaults: ['@group'], parseDefaults: true, immediateFrom: 0 })
declare(operators.count, { immediateFrom: 1, defaults: [true] })
declare(operators.last, { immediateFrom: 1, defaults: [true] })
declare(operators.first, { immediateFrom: 1, defaults: [true] })

// @ts-ignore This is a virtual operator, but we'll allow it for now.
declare(sum, { defaults: [{ val: '' }] })

// @ts-ignore This is a virtual operator, but we'll allow it for now.
declare(average, { defaults: [{ val: '' }] })

/**
 * @param {keyof typeof operators | 'async'} name
 * @param {any[]} expressions
 * @param {{ eval?: boolean, engine?: import('json-logic-engine').LogicEngine, asyncEngine?: import('json-logic-engine').AsyncLogicEngine, ops?: any, n?: number }} options
 * @returns {Function}
 */
function buildOperator (name, expressions, { asyncEngine, n = 1, eval: evaluate = false, engine, ops = operators } = {}) {
  const operator = ops[name]
  const definition = operatorDefinitions.get(operator) || operator?.configuration || { immediateFrom: +!evaluate }
  const operatorFunc = operator?.operator || operator

  // a hack due to this being a truly virtual operator.
  if (name === 'async') definition.async = true

  if (n === 1 && definition.context) {
    mutateTraverse(expressions[0], i => {
      if (typeof i.val !== 'undefined') throw new Error('Do not use the typical "@" operator in a reducer. Use $.current and $.accumulator.')
      if (typeof i.context !== 'undefined') return { val: i.context }
      return i
    })
  }

  for (let i = 0; i < expressions.length; i++) {
    expressions[i] = i < definition.immediateFrom
      ? definition.async
          ? asyncEngine.build(expressions[i])
          : engine.build(expressions[i])
      : engine.run(expressions[i])
  }
  // console.log(name, expressions)

  const logic = expressions.shift()

  if (name === 'async') return operators.mergeMap(async (...args) => (await logic)(...args), ...expressions)

  if (!operator) throw new Error(`Operator '${name}' has not been exposed to the DSL.`)

  if (n === 1) {
    if (definition.context) {
      return operatorFunc((...args) => logic({ accumulator: args[0], current: args[1] }), ...expressions)
    }

    return operatorFunc(logic, ...expressions)
  }

  return operatorFunc((...args) => logic(args), ...expressions)
}

const defaultEngine = setupEngine(new LogicEngine())
const defaultAsyncEngine = setupEngine(new AsyncLogicEngine())

function parseExpressions (operator, expressions, { substitutions, engine, asyncEngine, additionalOperators, step }) {
  expressions = ensureDefaults(operator, expressions, { ...additionalOperators, ...operators })

  expressions = expressions.map(substitutionLogic({ ...substitutions, '@step': step }))

  let logicOperators = [
    [operator, ...expressions]
  ]

  if (virtualOperators[operator]) {
    logicOperators = virtualOperators[operator](...expressions)
  }

  return logicOperators.map(([head, ...expressions]) => {
    const mode = head.startsWith('!') ? 1 : head.startsWith('#') ? 2 : 0
    if (head.startsWith('#') || head.startsWith('!')) head = head.substring(1)
    return buildOperator(head, expressions, {
      n: mode === 1 ? 2 : 1,
      eval: mode === 2,
      engine,
      asyncEngine,
      ops: { ...additionalOperators, ...operators }
    })
  })
}

function substitutionLogic (substitutions) {
  return expression => mutateTraverse(clone(expression), i => {
    if (i && typeof i === 'object') {
      for (const k in substitutions) {
        if (k in i) {
          return substitutions[k]
        }
      }
    }
    return i
  })
}

/**
 * Evaluates the expressions of an operator & determines if it needs to add inject default expressions.
 * @param {string} operator
 * @param {any[]} expressions
 * @param {any} operators
 */
function ensureDefaults (operator, expressions, operators) {
  const definition = operatorDefinitions.get(virtualOperators[operator]) || operatorDefinitions.get(operators[operator]) || operators[operator]?.configuration || {}
  if (definition.defaults && definition.defaults.length > (expressions.length - definition.defaultStart)) {
    if (expressions.length - definition.defaultStart) { throw new Error(`Not enough parameters for operator '${operator}'.`) }
    expressions = [...expressions, ...definition.defaults.slice(expressions.length - definition.defaultStart)]
  }
  return expressions
}

/**
 * Takes in the instructions from the dsl and generates functions to be used
 * in an RxJS pipeline.
 * @param {*} program
 * @param {{ engine?: import('json-logic-engine').LogicEngine, asyncEngine?: import('json-logic-engine').AsyncLogicEngine, substitutions?: any, additionalOperators?: any, meta?: { step: string } }} options
 * @returns {((...args) => any)[]}
 */
function buildDSL (program, {
  substitutions = {},
  engine = defaultEngine,
  asyncEngine = defaultAsyncEngine,
  additionalOperators = {},
  meta = { step: '$' }
} = {}) {
  return program.flat().flatMap((item, expressionIndex) => {
    if (item.operator) {
      // expressions
      return parseExpressions(item.operator, item.expressions || [], { substitutions, engine, asyncEngine, additionalOperators, step: `${meta.step}.${expressionIndex}`.substring(2) })
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
              additionalOperators,
              meta: {
                step: `${meta.step}.${expressionIndex}~(${group.key})`
              }
            })
          )
        }),
        // merge them in.
        rxOps.mergeAll(item.concurrency)
      ]
    } else if (item.fork) {
      let operation = merge
      if (item.type in joinOperators) operation = joinOperators[item.type]
      return rxOps.connect(i => operation(
        ...item.fork.map((logic, forkIndex) => {
          // @ts-ignore
          return i.pipe(...buildDSL(logic, {
            substitutions,
            additionalOperators,
            engine,
            asyncEngine,
            meta: {
              step: `${meta.step}.${expressionIndex}~(${forkIndex})`
            }
          }))
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
 * @returns {[import('rxjs').UnaryFunction<any, any>]}
 */
export function dsl (str, {
  substitutions = {},
  engine = defaultEngine,
  asyncEngine = defaultAsyncEngine,
  additionalOperators = {}
} = {}) {
  const program = parse(str, { startRule: 'Document' })
  return [pipe(
    // @ts-ignore
    ...buildDSL(program, { substitutions, engine, asyncEngine, additionalOperators })
  )]
}

/**
 * Parses a string into a JSON-Logic program.
 * @param {string} str
 */
export function generateLogic (str) {
  return parse(str, { startRule: 'Expression' })
}

/**
 * Adds a method that allows you to parse the DSL Script into the JSON Document.
 * @param {string} str
 * @returns {({ expressions: any[], operator: string } | { split: any[] } | { fork: any[] })[]}
 */
export function generatePipeline (str) {
  return parse(str, { startRule: 'Document' })
}

export default {
  dsl,
  generateLogic,
  generatePipeline,
  declare
}

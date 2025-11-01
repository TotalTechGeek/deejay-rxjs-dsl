import { splitEvery, xprod, omit, pick, type } from 'ramda'
import { isArray, isBoolean, isDate, isFalse, isFalsy, isNumber, isInteger, isIterable, isObject, isFinite, isNull, isValidDate, isUndefined, isString, isTruthy } from 'ramda-adjunct'
import * as time from 'date-fns'
import { AsyncLogicEngine, Compiler } from 'json-logic-engine'
import { queryBuilder, objectQueryBuilder, generatorBuilder } from 'json-power-query'
import { createReducer } from './bin.js'
import { kjoin } from './joins.js'
import { mutateTraverse } from './mutateTraverse.js'
import { of, from, EMPTY } from 'rxjs'

const { build, buildString } = Compiler

const dynamicTimeBin = createReducer(10)
const dynamicBin = createReducer(10, [1, 5, 10, 20, 100, 200, 1000, 5000, 10e3, 50e3, 100e3, 500e3, 1e6, 5e6, 10e6, 50e6, 100e6])

/**
 * Rountds the time to nearest interval
 * @param {Date|Number|String} time
 * @param period
 * @param {'s'|'m'|'minutes'|'seconds'|'days'|'d'|'h'|'hours'|'months'|'M'} units
 */
function roundTime (time, period = 1, units = 's', end = false) {
  if (!time) { return time }
  if (units === 's' || units === 'seconds') { period *= 1000 } else if (units === 'm' || units === 'minutes') { period *= 60 * 1000 } else if (units === 'hours' || units === 'h') { period *= 60 * 1000 * 60 } else if (units === 'days' || units === 'd') { period *= 60 * 1000 * 24 * 60 } else if (units === 'M' || units === 'months') { period *= 60 * 1000 * 60 * 24 * 60 * 30 } else if (units === 'y' || units === 'years') { period *= 60 * 1000 * 60 * 24 * 60 * 30 }
  time = time.getTime ? time.getTime() : typeof time === 'string' ? new Date(time).getTime() : time
  return new Date((((time / period) | 0) + (end ? 1 : 0)) * period)
}

const arrayQuery = {
  method: ([path, obj]) => {
    return queryBuilder(path)(obj)
  },
  compile: ([path, data], buildState) => {
    buildState.methods.push(queryBuilder(path))
    return `methods[${buildState.methods.length - 1}](${buildString(data, buildState)})`
  }
}

const query = {
  method: ([path, obj]) => {
    return generatorBuilder(path)(obj)
  },
  compile: ([path, data], buildState) => {
    buildState.methods.push(generatorBuilder(path))
    return `methods[${buildState.methods.length - 1}](${buildString(data, buildState)})`
  }
}

const objectQuery = {
  method: (path, obj) => {
    return objectQueryBuilder(JSON.parse(path))(obj)
  },
  compile: ([data, path], buildState) => {
    buildState.methods.push(objectQueryBuilder(JSON.parse(path)))
    return `methods[${buildState.methods.length - 1}](${buildString(data, buildState)})`
  }
}

const deterministic = { deterministic: true, sync: true, optimizeUnary: true }

/**
 * The logic engine you wish to set up.
 * @param {import('json-logic-engine').LogicEngine} engine
 */
function setupEngine (engine) {
  engine.addMethod('aQuery', arrayQuery, deterministic)
  engine.addMethod('query', query, deterministic)
  engine.addMethod('dynamicTimeBin', ([a, b, size]) => dynamicTimeBin(a, b, size))
  engine.addMethod('dynamicBin', ([a, b, c]) => dynamicBin(a, b, c))
  engine.addMethod('toPairs', i => Object.entries(i), deterministic)
  engine.addMethod('toPairsObject', i => Object.entries(i).map(([key, value]) => ({ [key]: value })), deterministic)
  engine.addMethod('fromPairs', i => Object.fromEntries(i), deterministic)
  engine.addMethod('from', ([key, value]) => Object.fromEntries([[key, value]]), deterministic)
  engine.addMethod('combine', (data) => Object.assign({}, ...data), deterministic)
  engine.addModule('Math', Math, deterministic)
  engine.addMethod('split', ([i, splitter]) => ('' + i).split(splitter || ''), deterministic)
  engine.addMethod('xprod', data => xprod(...[].concat(data)), deterministic)
  engine.addMethod('omit', ([obj, keys]) => omit(keys, obj), deterministic)
  engine.addMethod('pick', ([obj, keys]) => pick(keys, obj), deterministic)
  engine.addMethod('type', i => type(i), deterministic)
  engine.addMethod('isArray', i => isArray(i), deterministic)
  engine.addMethod('isBoolean', i => isBoolean(i), deterministic)
  engine.addMethod('isDate', i => isDate(i), deterministic)
  engine.addMethod('isFalsy', i => isFalsy(i), deterministic)
  engine.addMethod('isTruthy', i => isTruthy(i), deterministic)
  engine.addMethod('isFinite', i => isFinite(i), deterministic)
  engine.addMethod('isFalse', i => isFalse(i), deterministic)
  engine.addMethod('isInteger', i => isInteger(i), deterministic)
  engine.addMethod('isIterable', i => isIterable(i), deterministic)
  engine.addMethod('isNull', i => isNull(i), deterministic)
  engine.addMethod('isNumber', i => isNumber(i), deterministic)
  engine.addMethod('isObject', i => isObject(i), deterministic)
  engine.addMethod('isUndefined', i => isUndefined(i), deterministic)
  engine.addMethod('isString', i => isString(i), deterministic)
  engine.addMethod('isValidDate', i => isValidDate(i), deterministic)
  engine.addMethod('rx.of', i => of(i), deterministic)
  engine.addMethod('rx.from', i => from(i), deterministic)
  engine.addMethod('rx.empty', () => EMPTY, deterministic)
  engine.addMethod('join', data => {
    if (Array.isArray(data[0])) {
      const [arr, splitter] = data
      return arr.join(splitter || '')
    }
    return data.join('')
  }, deterministic)
  engine.addMethod('objectQuery', objectQuery, deterministic)
  engine.addMethod('aggregate', ([accumulator, current]) => {
    if (!accumulator) { accumulator = { count: 0, sum: 0, sum2: 0, min: Infinity, max: -Infinity } }

    accumulator.count += 1
    accumulator.sum += current
    accumulator.sum2 += current ** 2
    accumulator.min = Math.min(accumulator.min, current)
    accumulator.max = Math.max(accumulator.max, current)

    return accumulator
  })
  engine.addMethod('date', ([i]) => (i ? new Date(i) : new Date()))
  engine.addMethod('stringify', i => JSON.stringify(i), deterministic)
  engine.addMethod('startsWith', ([a, b]) => ('' + a).startsWith(b), deterministic)
  engine.addMethod('first', i => i[0], deterministic)
  engine.addMethod('last', i => i[i.length - 1], deterministic)
  engine.addMethod('kjoin', (data) => kjoin(...data), deterministic)
  engine.addMethod('log', i => console.log(i))
  engine.addMethod('match', {
    method: data => {
      // 0 is the variable,
      // odds are the comparisons it should be equal to,
      // evens are the values

      const variable = data[0]
      const options = data.slice(1)

      if (options.length % 2 !== 1) {
        throw new Error('Match statement lacks the correct arguments.')
      }

      for (let i = 0; i < options.length; i += 2) {
        if (options[i] === variable) return options[i + 1]
      }

      return options[options.length - 1]
    },
    compile: (data, buildState) => {
      const variable = data[0]
      const options = data.slice(1)
      const def = options.pop()

      if (options.length % 2) {
        throw new Error('Match statement lacks the correct arguments.')
      }

      const cases = splitEvery(2, options)
        .map(([name, value]) => `case ${buildString(name, buildState)}: return ${buildString(value, buildState)};`)
        .join('\n')

      return `((() => { switch (${buildString(variable, buildState)}) { ${cases} default: return ${buildString(def, buildState)}; } })())`
    },
    traverse: true,
    deterministic: true
  }, { sync: true })

  engine.addMethod('list', {
    method: i => i ? [].concat(i) : [],
    deterministic: true,
    traverse: true,
    sync: true
  })

  engine.addMethod('overwrite', {
    method: ([obj, name, value]) => {
      return ({ ...obj, [name]: value })
    },
    traverse: true,
    sync: true
  })

  engine.addMethod('each', {
    method: ([obj, transform], context, above, engine) => {
      obj = engine.run(obj, context, { above })
      const result = { ...obj }
      const internalTransform = typeof transform === 'object'
        ? mutateTraverse({ ...transform }, i => {
            if (i.$ignore) { return i }
            if (typeof i.context !== 'undefined') {
              return { var: i.context, $ignore: true }
            }
            if (typeof i.var !== 'undefined') {
              return { var: `../${i.var}`, $ignore: true }
            }
            return i
          })
        : transform
      for (const i in result) {
        result[i] = engine.run(internalTransform, result[i], { above: [...above, context] })
      }
      return result
    },
    asyncMethod: async ([obj, transform], context, above, engine) => {
      obj = await engine.run(obj, context, { above })
      const result = { ...obj }
      const internalTransform = typeof transform === 'object'
        ? mutateTraverse({ ...transform }, i => {
            if (i.$ignore) { return i }
            if (typeof i.context !== 'undefined') {
              return { var: i.context, $ignore: true }
            }
            if (typeof i.var !== 'undefined') {
              return { var: `../${i.var}`, $ignore: true }
            }
            return i
          })
        : transform
      for (const i in result) {
        result[i] = await engine.run(internalTransform, result[i], { above: [...above, context] })
      }
      return result
    },
    traverse: false
  })

  const asyncEngine = new AsyncLogicEngine()
  engine.addMethod('async', {
    lazy: true,
    compile: (data, buildState) => {
      asyncEngine.methods = buildState.engine.methods
      asyncEngine.fallback.methods = buildState.engine.methods

      const method = asyncEngine.build(data)
      const method2 = async (ctx) => (await method)(ctx)

      buildState.methods.push(method2)
      return `await methods[${buildState.methods.length - 1}](context)`
    }
  })

  engine.addMethod('**', ([a, b]) => (+a) ** (+b), deterministic)

  engine.addMethod('obj', {
    method: (items) => {
      return items ? splitEvery(2, items).reduce((accumulator, [variable, value]) => ({ ...accumulator, [variable]: value }), {}) : {}
    },
    traverse: true,
    // deterministic: true,
    compile: (data, buildState) => {
      if (!data) return '({})'
      data = [].concat(data)
      if (!data.length % 2) { return false }
      const items = splitEvery(2, data).map(([variable, item]) => {
        return `[${buildString(variable, buildState)}]: ${buildString(item, buildState)}`
      })
      return `({ ${items.join(', ')} })`
    }
  })
  engine.addMethod('groupBy', {
    compile: ([accumulator, current, func, transform, defaultValue], buildState) => {
      const keyFunc = build(func, buildState)
      buildState.methods.push(keyFunc)
      const keyFuncPosition = buildState.methods.length - 1
      const transformFunc = typeof transform !== 'undefined' ? build(transform, buildState) : null
      buildState.methods.push(transformFunc)
      const transformFuncPosition = buildState.methods.length - 1
      const defaultValueInsert = typeof defaultValue !== 'undefined' ? buildString(defaultValue, buildState) : '[]'
      return `((() => {
            let accumulator = ${buildString(accumulator, buildState)};
            if (!accumulator) accumulator = {};
            const current = ${buildString(current, buildState)};
            const key = methods[${keyFuncPosition}](current);
            const defaultValue = ${defaultValueInsert};
            accumulator[key] = typeof accumulator[key] !== 'undefined' ? accumulator[key] : defaultValue;
            ${transformFunc ? `accumulator[key] = methods[${transformFuncPosition}]({ accumulator: accumulator[key], current })` : 'accumulator[key].push(current)'};
            return accumulator;
        })())`
    },
    traverse: false
  })
  const spreadTime = Object.keys(time).reduce((accumulator, func) => {
    accumulator[func] = (args) => {
      if (Array.isArray(args)) {
        if (typeof args[0] === 'string') { args[0] = new Date(args[0]) }
        return time[func](...args)
      }
      if (typeof args === 'string') { args = new Date(args) }
      return time[func](args)
    }
    return accumulator
  }, {})
  engine.addModule('time', spreadTime, deterministic)
  engine.addMethod('time.snapTo', ([date, period, end = false]) => {
    if (typeof date === 'string') { date = new Date(date) }
    if (period === 's' || period === 'sec' || period === 'seconds' || period === 'second') {
      if (end) { return time.formatISO(time.endOfSecond(date)) }
      return time.formatISO(time.startOfSecond(date))
    }
    if (period === 'm' || period === 'min' || period === 'minutes' || period === 'minute') {
      if (end) { return time.formatISO(time.endOfMinute(date)) }
      return time.formatISO(time.startOfMinute(date))
    }
    if (period === 'd' || period === 'day' || period === 'days') {
      if (end) { return time.formatISO(time.endOfDay(date)) }
      return time.formatISO(time.startOfDay(date))
    }
    if (period === 'M' || period === 'month' || period === 'months' || period === 'Mo' || period === 'mo') {
      if (end) { return time.formatISO(time.endOfMonth(date)) }
      return time.formatISO(time.startOfMonth(date))
    }
    if (period === 'y' || period === 'year' || period === 'years') {
      if (end) { return time.formatISO(time.endOfYear(date)) }
      return time.formatISO(time.startOfYear(date))
    }
    throw new Error('Unrecognized time frame.')
  }, deterministic)

  engine.addMethod('time.roundDate', ([time, period, units, end]) => roundTime(time, period, units, end), deterministic)
  engine.addMethod('time.round', ([time, period, units, end]) => roundTime(time, period, units, end).toISOString(), deterministic)
  engine.methods.get = {
    ...engine.methods.get,
    compile: function (data, buildState) {
      let defaultValue = null
      let key = data
      let obj = null
      if (Array.isArray(data) && data.length <= 3) {
        obj = data[0]
        key = data[1]
        defaultValue = typeof data[2] === 'undefined' ? null : data[2]
        const pieces = typeof key === 'string' ? key.split('.').map(i => JSON.stringify(i)) : [buildString(key, buildState)]
        return `((${buildString(obj, buildState)})${pieces
          .map((i) => `?.[${i}]`)
          .join('')} ?? ${JSON.stringify(defaultValue)})`
      }
      return false
    }
  }
  return engine
}

export { setupEngine }
export default {
  setupEngine
}

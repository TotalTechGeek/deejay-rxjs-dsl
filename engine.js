
const _ = require('lodash')
const time = require('date-fns')
const { LogicEngine } = require('json-logic-engine')

const { build, buildString } = require('json-logic-engine/compiler')
const { queryBuilder, objectQueryBuilder } = require('json-power-query')

const { createReducer } = require('./bin')
const engine = new LogicEngine()


const query = { 
    method: (path, obj) => {
        return queryBuilder(path)(obj)
    },
    compile: ([path, data], buildState) => {
        buildState.methods.push(queryBuilder(path))
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

const dynamicTimeBin = createReducer(10)
engine.addMethod('dynamicTimeBin', ([a, b, size]) => dynamicTimeBin(a, b, size))
const dynamicBin = createReducer(10, [1, 5, 10, 20, 100, 200, 1000, 5000, 10e3, 50e3, 100e3, 500e3, 1e6, 5e6, 10e6, 50e6, 100e6])
engine.addMethod('dynamicBin', ([a,b,c]) => dynamicBin(a,b,c))
engine.addMethod('toPairs', i => _.toPairs(i), { deterministic: true })
engine.addMethod('fromPairs', i => _.fromPairs(i), { deterministic: true })
engine.addMethod('from', ([key, value]) => _.fromPairs([[key, value]]), { deterministic: true })
engine.addMethod('combine', ([a,b]) => ({...a, ...b}), { deterministic: true })
engine.addModule('Math', Math, { deterministic: true })
engine.addMethod('split', ([i, splitter]) => i.split(splitter), { deterministic: true })
engine.addMethod('objectQuery', objectQuery, { deterministic: true })
engine.addMethod('aggregate', ([accumulator, current]) => {
    if(!accumulator) accumulator = { count: 0, sum: 0, min: Number.MAX_VALUE, max: 0 }
    return { 
        count: accumulator.count + 1, 
        sum: accumulator.sum + current, 
        sum2: accumulator.sum + current ** 2, 
        min: Math.min(accumulator.min, current), 
        max: Math.max(accumulator.max, current)  
    }
})
engine.addMethod('date', i => (i ? new Date(i) : new Date()))
engine.addMethod('stringify', i => JSON.stringify(i), { deterministic: true })
engine.addMethod('startsWith', ([a,b]) => (''+a).startsWith(b), { deterministic: true })
engine.addMethod('first' , i => i[0], { deterministic: true })
engine.addMethod('last' , i => i[i.length-1], { deterministic: true })
engine.addMethod('query', query, { deterministic: true })
engine.addMethod('list', i => [].concat(i), { deterministic: true })
engine.addMethod('overwrite', { 
    method: ([obj, name, value], context, above, engine) =>  { 
        return ({...obj, [name]: value }) 
    },
    traverse: true
})
function _mutateTraverse (obj, mut = i => i) {
    if(!obj) return obj

    for (const key in obj) {
        if (typeof obj[key] === 'object') {
            obj[key] = _mutateTraverse(obj[key], mut)
        }
    }

    return mut(obj)
}

engine.addMethod('each', { 
    method: ([obj, transform], context, above, engine) =>  { 
        obj = engine.run(obj, context, { above })
        const result = { ...obj }

        const internalTransform = typeof transform === 'object' ? _mutateTraverse({ ...transform }, i => {
            if (i.$ignore) return i
            if (typeof i.context !== 'undefined') {
                return { var: i.context, $ignore: true }
            }
            if (typeof i.var !== 'undefined') {
                return { var: `../${i.var}`, $ignore: true }
            }
            return i
        }) : transform

        for (const i in result) {
            result[i] = engine.run(internalTransform, result[i], { above: [...above, context] })
        }

        return result
    },
    asyncMethod: async ([obj, transform], context, above, engine) =>  { 
        obj = await engine.run(obj, context, { above })
        const result = { ...obj }

        const internalTransform = typeof transform === 'object' ? _mutateTraverse({ ...transform }, i => {
            if (i.$ignore) return i
            if (typeof i.context !== 'undefined') {
                return { var: i.context, $ignore: true }
            }
            if (typeof i.var !== 'undefined') {
                return { var: `../${i.var}`, $ignore: true }
            }
            return i
        }) : transform

        for (const i in result) {
            result[i] = await engine.run(internalTransform, result[i], { above: [...above, context] })
        }

        return result
    },
    traverse: false,
    useContext: true
})

engine.addMethod('csvify', ([item, attributes]) => {
    const attrs = attributes.split(',')
    let str = ''
    
    for (const attr of attrs) {
        if (str) str += ','
        str += `"${(typeof item[attr] === 'undefined' ? '' : item[attr]).toString().replace(/"/g, '""')}"`
    }
    return str
}, { deterministic: true })


engine.addMethod('snakeCase', _.snakeCase, { deterministic: true })

function processBin (bin) {
    const variance = (bin.count * bin.sum2 - bin.sum) / (bin.count * (bin.count - 1))
    return {
        min: bin.min,
        max: bin.max,
        count: bin.count,
        sum: bin.sum,
        average: bin.sum / bin.count,
        variance,
        stddev: Math.sqrt(variance)
    }
}

engine.addMethod('processBin', processBin, { deterministic: true })

engine.addMethod('processBins', bins => {
    const result = {}
    for (const key in bins) {
        result[key] = processBin(bins[key])
    }
    return result
}, { deterministic: true })

engine.addMethod('xy', ([x, y]) => ({ x, y }))

const everyOther = (arr, i = -1) => _.partition(arr, () => i++ % 2) 
engine.addMethod('obj', (items) => _.zipObject(...everyOther([].concat(items))))

engine.addMethod('groupBy', { 
    compile:  ([accumulator, current, func, transform, defaultValue], buildState) => {
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
            if (typeof args[0] === 'string') args[0] = new Date(args[0])
            return time[func](...args) 
        }
        if (typeof args === 'string') args = new Date(args)
        return time[func](args) 
    }
    return accumulator
}, {})

engine.addModule('time', spreadTime, { deterministic: true })

engine.addMethod('time.snapTo', ([date, period, end = false]) => {
    if (typeof date === 'string') date = new Date(date)

    if (period === 's' || period === 'sec' || period === 'seconds' || period === 'second') {
        
        if (end) return time.formatISO(time.endOfSecond(date))
        return time.formatISO(time.startOfSecond(date))
    }
    
    if (period === 'm' || period === 'min' || period === 'minutes' || period === 'minute') {
        if (end) return time.formatISO(time.endOfMinute(date))
        return time.formatISO(time.startOfMinute(date))
    }

    if (period === 'd' || period === 'day' || period === 'days') {
        if (end) return time.formatISO(time.endOfDay(date))
        return time.formatISO(time.startOfDay(date))
    }

    if (period === 'M' || period === 'month' || period === 'months' || period === 'Mo' || period === 'mo') {
        if (end) return time.formatISO(time.endOfMonth(date))
        return time.formatISO(time.startOfMonth(date))
    }

    if (period === 'y' || period === 'year' || period === 'years') {
        if (end) return time.formatISO(time.endOfYear(date))
        return time.formatISO(time.startOfYear(date))
    }

    throw new Error('Unrecognized time frame.')
}, { deterministic: true })

/**
 * 
 * @param {Date|Number|String} time 
 * @param period
 * @param {'s'|'m'|'minutes'|'seconds'|'days'|'d'|'h'|'hours'|'months'|'M'} units 
 */
 function roundTime (time, period = 1, units = 's', end = false) {
    if (!time) return time

    if (units === 's' || units === 'seconds') period *= 1000
    else if (units === 'm' || units === 'minutes') period *= 60 * 1000
    else if (units === 'hours' || units === 'h') period *= 60 * 1000 * 60
    else if (units === 'days' || units === 'd') period *= 60 * 1000 * 24 * 60
    else if (units === 'M' || units === 'months') period *= 60 * 1000 * 60 * 24 * 60 * 30
    else if (units === 'y' || units === 'years') period *= 60 * 1000 * 60 * 24 * 60 * 30
    

    time = time.getTime ? time.getTime() : typeof time === 'string' ? new Date(time).getTime() : time
    
    return new Date((((time / period) | 0) + (end ? 1 : 0)) * period)
}

engine.addMethod('time.roundDate', ([time, period, units, end]) => roundTime(time, period, units, end), { deterministic: true })
engine.addMethod('time.round', ([time, period, units, end]) => roundTime(time, period, units, end).toISOString(), { deterministic: true })

module.exports = { engine }
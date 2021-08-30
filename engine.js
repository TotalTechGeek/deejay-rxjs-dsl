
const _ = require('lodash')
const { LogicEngine } = require('json-logic-engine')

const { buildString } = require('json-logic-engine/compiler')
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

engine.addMethod('notify', ([key, data, category]) => {
    console.log(`Sagas waiting for resource: ${key} in category ${category} will be informed of ${JSON.stringify(data)}.`)
})
engine.addMethod('aggregate', ([a,b]) => {
    if(!a) {
        a = { count: 0, sum: 0 }
    }
    return { count: a.count + 1, sum: a.sum + b }
})
engine.addMethod('date', i => new Date().toISOString())
engine.addMethod('stringify', i => JSON.stringify(i), { deterministic: true })
engine.addMethod('startsWith', ([a,b]) => (''+a).startsWith(b), { deterministic: true })
engine.addMethod('first' , i => i[0], { deterministic: true })
engine.addMethod('last' , i => i[i.length-1], { deterministic: true })
engine.addMethod('query', query, { deterministic: true })
engine.addMethod('log', i => console.log(i))
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

module.exports = { engine }
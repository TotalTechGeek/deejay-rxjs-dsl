const ExpiryMap = require('expiry-map').default

const defaultIntervals = [30, 60, 60 * 5, 60 * 15, 60 * 30, 60 * 60, 60 * 60 * 2, 60 * 60 * 4, 60 * 60 * 8, 60 * 60 * 24, 60 * 60 * 24 * 3, 60 * 60 * 24 * 7, 60 * 60 * 24 * 30]
.map(i=>i*1000)

function scanIntervals (intervals) {
    for (let i = 1; i < intervals.length; i++) {
        if (intervals[i] % intervals[i-1]) console.warn(`The binning may not be pure because ${intervals[i]} does not divide by ${intervals[i-1]}, position ${i}.`)
    }
}

function addObject (a, b) {
    const result = { ...b }
    for (const key in a) {
        result[key] = (result[key] || 0) + a[key]
    }
    return result
}

function condense (obj, scale) {
    const result = {}
    for (const key in obj) {
        if (/^[0-9]+\-[0-9]+$/.exec(key)) {
            const [top] = key.split('-');
            const zone = (BigInt(top) / BigInt(scale)) | 0n
            const bucket = `${zone*scale}-${zone*scale+scale}`
            result[bucket] = addObject(result[bucket] || {}, obj[key])
        } else {
            result[key] = obj[key]
        }
    }
    return result
}

function sortKeys(obj) {
    const keys = Object.keys(obj).sort((a,b) => {
        return a.split('-')[0] - b.split('-')[0]
    })
    const result = {}
    for (const key of keys) {
        result[key] = obj[key]
    }
    return result
}

function createReducer (maxLength = 3, intervals = defaultIntervals, warn = false) {
    const intervalTracked = new ExpiryMap(180e3) // keeps track of this interval for efficiency for 3m, it's okay to recompute though
    if (warn) scanIntervals(intervals)
    function push (obj, { x, y }, size = maxLength) {
        if (!obj) obj = {}
        let [interval, nonInterval] = intervalTracked.get(obj) || [0, 0]
        const startingAggregate = obj
        let scale = BigInt(intervals[interval])

        let intervalChanged = false
        if (Number.isNaN(+x)) {
            const bucket = x
            intervalChanged = !obj[bucket]
            if (intervalChanged) nonInterval++
            obj[bucket] = addObject(obj[bucket] || {}, { count: 1, sum: y })            
        } 
        else {
            const zone = (BigInt(x) / BigInt(scale)) | 0n
            const bucket = `${zone*scale}-${zone*scale+scale}`
            
            intervalChanged = !obj[bucket]
            obj[bucket] = addObject(obj[bucket] || {}, { count: 1, sum: y })
    
            while (Object.keys(obj).length - nonInterval > size) {
                interval++
                scale = BigInt(intervals[Math.min(interval, intervals.length -1)]) * BigInt(10**Math.max(interval - intervals.length + 1, 0))
                obj = condense(obj, scale)
                intervalChanged = true
            }
        }

        if (intervalChanged) {
            obj = sortKeys(obj)
            // yes, I'm aware it can fall out of scope if the interval doesn't change for a few minutes.
            // this is unlikely though, but keeps things performant.
            if (startingAggregate !== obj) intervalTracked.delete(startingAggregate)
            intervalTracked.set(obj, [interval, nonInterval])
        }

        return obj
    }
    return push
}

module.exports = { createReducer }
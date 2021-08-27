


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
        const [top] = key.split('-');
        const zone = (top / scale) | 0
        const bucket = `${zone*scale}-${zone*scale+scale}`
        result[bucket] = addObject(result[bucket] || {}, obj[key])
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
    let interval = 0
    if (warn) scanIntervals(intervals)
    function push (obj, { x, y }, size = maxLength) {
        if (!obj) obj = {}
        let scale = intervals[interval]
        const zone = (x / scale) | 0
        const bucket = `${zone*scale}-${zone*scale+scale}`
        let resort = !obj[bucket]    
        obj[bucket] = addObject(obj[bucket] || {}, { count: 1, sum: y })
        while (Object.keys(obj).length > size) {
            interval++
            scale = intervals[Math.min(interval, intervals.length -1)] * (10**Math.max(interval - intervals.length + 1, 0))
            obj = condense(obj, scale)
            resort = true
        }

        if (resort) obj = sortKeys(obj)
        return obj
    }
    return push
}

module.exports = { createReducer }
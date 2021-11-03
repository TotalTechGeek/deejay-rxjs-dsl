import { Observable } from 'rxjs'

export const bufferReduce = (reducer, initial, { count = 1 } = {}) => source => new Observable(observer => {
  // only performs a shallow copy
  function resetAccumulator () {
    const cur = initial
    if (Array.isArray(cur)) return [...cur]
    if (typeof cur === 'object') return { ...cur }
    return cur
  }

  let processed = 0
  let accumulator = resetAccumulator()
  let inFlight = false

  return source.subscribe({
    complete: () => {
      if (inFlight) {
        observer.next(accumulator)
      }
      observer.complete()
    },
    error: (err) => observer.error(err),
    next: current => {
      accumulator = reducer(accumulator, current)
      inFlight = true
      processed++
      // if we have processed enough items, emit the accumulated value
      if (processed === count) {
        observer.next(accumulator)
        processed = 0
        accumulator = resetAccumulator()
        inFlight = false
      }
    }
  })
})

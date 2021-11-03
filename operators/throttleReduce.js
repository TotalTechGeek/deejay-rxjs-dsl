import throttle from 'lodash.throttle'
import { Observable } from 'rxjs'

export const throttleReduce = (reducer, initial, { time = 1000, leading = false, trailing = true } = {}) => source => new Observable(observer => {
  const next = throttle(i => {
    observer.next(i)
    accumulator = resetAccumulator()
    if (ended) observer.complete()
    inFlight = false
  }, time, {
    trailing,
    leading
  })

  // only performs a shallow copy
  function resetAccumulator () {
    const cur = initial
    if (Array.isArray(cur)) return [...cur]
    if (typeof cur === 'object') return { ...cur }
    return cur
  }

  let accumulator = resetAccumulator()
  let ended = false
  let inFlight = false

  return source.subscribe({
    complete: () => {
      ended = true
      if (!inFlight) observer.complete()
    },
    error: (err) => observer.error(err),
    next: current => {
      accumulator = reducer(accumulator, current)
      inFlight = true
      next(accumulator)
    }
  })
})

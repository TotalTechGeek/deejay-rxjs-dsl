import { Observable, Subject } from 'rxjs'

/**
 * An operator similar to "windowTime" that makes it simpler to split a stream based on a designated
 * time interval, without creating sub-streams if there is no data flowing in.
 *
 * While windowTime and non-strict mode both struggle with closing the new stream when the event-loop is flooded,
 * this operator will not if "strict" is set to true. Setting strict to true will force a flush on the given time
 * interval as data is flooding in.
 *
 * @param {number} time
 * @param {boolean} [strict]
 */
const flush = (time, strict = false) => source => new Observable(subscriber => {
  let timeout = null
  let current = null
  let startTime = null
  let sub = null
  const complete = () => {
    if (timeout) clearTimeout(timeout)
    if (current) current.complete()
    if (sub) sub.unsubscribe()
  }

  sub = source.subscribe({
    next: (value) => {
      if (strict && startTime && (Date.now() - startTime > time)) {
        if (current) current.complete()
        current = null
        clearTimeout(timeout)
      }

      if (!current) {
        current = new Subject()
        subscriber.next(current)
        startTime = Date.now()
        timeout = setTimeout(() => {
          current.complete()
          current = null
        }, time)
      }

      current.next(value)
    },
    error: (err) => {
      if (timeout) clearTimeout(timeout)
      if (current) current.error(err)
      subscriber.error(err)
    },
    complete
  })

  return complete
})

export default flush

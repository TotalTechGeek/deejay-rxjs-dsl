import { Observable, Subject } from 'rxjs'
import { adapt } from '../utils.js'

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

export default adapt(flush)

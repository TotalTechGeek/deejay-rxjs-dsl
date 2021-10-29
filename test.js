/* eslint-disable no-unused-vars */
import { from, throttleTime, debounceTime } from 'rxjs'
import { dsl, generateLogic, engine } from './index.js'

function * gen (count = Infinity) {
  let i = 0
  while (i++ < count) {
    // if(!(i%10000)) await new Promise(resolve => setTimeout(resolve, 1))
    // yield { date: new Date(new Date('2020-05-03').getTime() + ((Math.random() * 1e11)| 0)), age: Math.random() * 80    }
    yield [Math.random() * 50, Math.random() * 30]
  }
}

console.time('Pipeline')
from(gen(5.5e5)).pipe(...dsl(`
        map merge(@, @.0 * @.1)
        mergeMap toPairs(@)
        reduce groupBy($.accumulator, $.current, $.0, aggregate($.accumulator, $.current.1), 0), 0
    `)).subscribe({
  next: console.log,
  complete: () => {
    console.timeEnd('Pipeline')
  }
})

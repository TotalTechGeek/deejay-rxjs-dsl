/* eslint-disable no-unused-vars */
import { from, throttleTime, debounceTime, Observable } from 'rxjs'
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
from(gen()).pipe(...dsl(` 
  take 1000000
  groupBy Math.floor(@.0 / 10) * 10 >> average @.1; map ({ x: @group, y: @ }) <<
  filter @.x > 20
  sum @.x
`)
).subscribe({
  next: console.log,
  complete: () => {
    console.timeEnd('Pipeline')
  }
})

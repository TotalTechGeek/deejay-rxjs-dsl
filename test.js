/* eslint-disable no-unused-vars */
import { from, throttleTime, debounceTime, Observable, pipe, map } from 'rxjs'
import { dsl, generateLogic } from './index.js'

function * gen (count = Infinity) {
  let i = 0
  while (i++ < count) {
    // if(!(i%10000)) await new Promise(resolve => setTimeout(resolve, 1))
    // yield { date: new Date(new Date('2020-05-03').getTime() + ((Math.random() * 1e11)| 0)), age: Math.random() * 80    }
    yield { name: 'Emily', age: Math.random() * 90, Team: Math.floor(Math.random() * 10) }
  }
}

console.time('Pipeline')
from(gen()).pipe(...dsl(` 
  take 1
  map { ...@, Math.floor(@.age) + 1  }
`)
).subscribe({
  next: console.log,
  complete: () => {
    console.timeEnd('Pipeline')
  }
})

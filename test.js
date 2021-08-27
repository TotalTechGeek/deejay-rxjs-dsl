const { from } = require('rxjs')
const { dsl } = require('.')

function * gen (count = Infinity) {
    let i = 0
    while (i++ < count) {
        yield { nice: (1000000 * Math.random()) | 0, code: [(9 * Math.random()) | 0] }
    }
}

from(gen(1000)).pipe(
   ...dsl(`
        reduce dynamicBin($.accumulator, objectQuery($.current,'{"x":"$.nice","y":"$.code.0"}'), 12), 0
    `),
).subscribe({
    next: console.log,
})
import { tap, pipe, catchError, identity } from 'rxjs'
const emit = (success, failure, subjects) => pipe(
  tap(data => {
    subjects[success(data)].next(data)
  }),
  failure
    ? catchError(err => {
        subjects[failure()].next(err)
      })
    : tap(identity)
)

export { emit }

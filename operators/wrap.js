import { map } from 'rxjs'
const wrap = (group) => map(i => ({ [group]: i }))
export default wrap

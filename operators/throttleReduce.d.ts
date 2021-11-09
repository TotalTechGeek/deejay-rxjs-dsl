export function throttleReduce(reducer: any, initial: any, { time, leading, trailing }?: {
    time?: number;
    leading?: boolean;
    trailing?: boolean;
}): (source: any) => Observable<any>;
import { Observable } from "rxjs";

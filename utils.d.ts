export function adapt<T, X, Z>(func: 
    (first: T, ...args: X[]) => Z,    
): (first: () => T, ...args: X[]) => Z;


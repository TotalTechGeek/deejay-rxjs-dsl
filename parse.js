import { parse as parsePeg } from './parser/dsl.js'

class ParseError extends Error {
  constructor (start, end, expected, found, script) {
    super('There was an error parsing your document')
    this.start = start
    this.end = end
    this.found = found

    this.start.text = script.split('\n').slice(start.line - 1, end.line).join('\n').trim()

    this.expectedSymbols = Array.from((expected || []).reduce((acc, i) => {
      ;[].concat(i.parts || i.text).forEach(i => i && acc.add(i))
      return acc
    }, new Set()))
  }
}

/**
  * Parses the instructions and attempts to provide decent feedback if it fails.
  * @param {string} script
  * @param {{ startRule: string }} options
  */
export function parse (script, { startRule }) {
  try {
    return parsePeg(script, { startRule })
  } catch (err) {
    throw new ParseError(err.location.start, err.location.end, err.expected, err.found, script)
  }
}

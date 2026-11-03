import { z } from './registry'

// Query-parameter coercion helpers.
//
// Express parses query strings into strings (or string arrays). These helpers
// wrap a logical Zod schema with `z.preprocess` so the raw wire value is
// coerced before validation, while `zod-to-openapi` still renders the inner
// (logical) schema. The inferred output is the logical type, so handlers and
// repositories receive coerced values (numbers, booleans, arrays) rather than
// raw strings, and malformed input fails validation (HTTP 400).

/** Coerce `'true'`/`'false'` query strings into a boolean schema. */
export function boolQuery<T extends z.ZodTypeAny>(schema: T) {
  return z.preprocess(
    (value) =>
      value === 'true' ? true : value === 'false' ? false : value,
    schema,
  )
}

/** Coerce a numeric query string into a number schema. */
export function intQuery<T extends z.ZodTypeAny>(schema: T) {
  return z.preprocess(
    (value) =>
      typeof value === 'string' && value.trim() !== '' ? Number(value) : value,
    schema,
  )
}

/** Split a delimited query string into an array before validation. */
export function delimitedQuery<T extends z.ZodTypeAny>(
  schema: T,
  separator: string,
) {
  return z.preprocess(
    (value) => (typeof value === 'string' ? value.split(separator) : value),
    schema,
  )
}

/** Split a delimited numeric query string into a number array. */
export function numberArrayQuery<T extends z.ZodTypeAny>(
  schema: T,
  separator = ',',
) {
  return z.preprocess((value) => {
    if (typeof value !== 'string') {
      return value
    }
    if (value === '') {
      return []
    }
    return value.split(separator).map((item) => Number(item))
  }, schema)
}

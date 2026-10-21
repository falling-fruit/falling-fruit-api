// Parsers for date / datetime request parameters. Each validates the input
// format and throws on malformed values, returning a normalized value or null.

const _ = {}

/**
 * Parse date.
 *
 * @param {string} value – Date in the format 'yyyy-mm-dd'.
 * @returns {string} Date in the format 'yyyy-mm-dd' or null.
 */
_.parse_date = function(value) {
  if (!value) {
    return null
  }
  // Check that date is yyyy-mm-dd
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw Error(`Date not formatted as yyyy-mm-dd: ${value}`)
  }
  const date = new Date(value)
  if (isNaN(date.getTime())) {
    throw Error(`Invalid date: ${value}`)
  }
  return date.toISOString().substring(0, 10)
}

/**
 * Parse datetime.
 *
 * @param {string} value – Datetime in the format 'yyyy-mm-ddTHH:MM:SSZ'
 * (decimal seconds are permitted).
 * @returns {string} Datetime in the same format, or null.
 */
_.parse_datetime = function(value) {
  if (!value) {
    return null
  }
  // Check that datetime is correctly formatted
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(value)) {
    throw Error(`Datetime not formatted as yyyy-mm-ddTHH:MM:SSZ: ${value}`)
  }
  const date = new Date(value)
  if (isNaN(date.getTime())) {
    throw Error(`Invalid datetime: ${value}`)
  }
  return value
}

module.exports = _

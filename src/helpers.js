require('dotenv').config()

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

_.set_equal = function(a, b) {
  return a.length === b.length && a.every(value => b.includes(value))
}

// ---- Input and output formatting ----

function is_object(x) {
  return (!!x) && (x.constructor === Object)
}

function null_empty_strings(obj) {
  if (!is_object(obj)) {
    return obj
  }
  const out = {}
  for (const [key, value] of Object.entries(obj)) {
    if (is_object(value)) {
      out[key] = null_empty_strings(value)
    } else {
      out[key] = value === "" ? null : value
    }
  }
  return out
}

_.null_empty_strings = null_empty_strings

module.exports = _

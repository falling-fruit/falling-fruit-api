require('dotenv').config()

const _ = {}

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

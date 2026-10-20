require('dotenv').config()
const bcrypt = require('bcrypt')
const crypto = require('crypto')

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

TYPE_CATEGORIES = ['forager', 'freegan', 'honeybee', 'grafter']

_.mask_bits = function(selected, all) {
  return all.reduce((acc, curr, i) => acc | (selected.includes(curr) ? 1 << i : 0), 0)
}

_.unmask_bits = function(mask, all) {
  return all.filter((_, i) => mask & (1 << i))
}

_.format_type = function(type) {
  const replaced = []
  // Format scientific names: [name, synonyms...]
  type.scientific_names = []
  if (type.scientific_name) {
    type.scientific_names.push(type.scientific_name)
  }
  if (type.scientific_synonyms) {
    type.scientific_names.push(...type.scientific_synonyms.split(', '))
  }
  replaced.push('scientific_name', 'scientific_synonyms')
  // Format common names: {locale: [name, synonyms...], ...}
  type.common_names = {}
  // Format urls: {tag: url, ...}
  type.urls = {}
  for (const key in type) {
    if (key == 'scientific_name') {
      continue
    }
    if (key.endsWith('_name')) {
      replaced.push(key)
      if (type[key]) {
        type.common_names[key.replace('_name', '')] = type[key].split(', ')
      }
    } else if (key.endsWith('_url')) {
      replaced.push(key)
      if (type[key]) {
        type.urls[key.replace('_url', '')] = type[key]
      }
    }
  }
  // Extract common names from notes
  if (type.notes) {
    const regex = /^common_names\.([a-z]{2}(?:_[a-z]{2})?): ([^\n]+)$/gm
    let match
    while ((match = regex.exec(type.notes)) !== null) {
      const [_, locale, names] = match
      type.common_names[locale] = names.split(', ')
    }
  }
  delete type.notes
  // Append English synonyms
  if (type.en_synonyms) {
    const synonyms = type.en_synonyms.split(', ')
    if ('en' in type.common_names) {
      type.common_names.en.push(...synonyms)
    } else {
      type.common_names.en = synonyms
    }
  }
  replaced.push('en_synonyms')
  // Replace _ with - in all common name keys
  for (const key in type.common_names) {
    if (key.includes('_')) {
      const new_key = key.replace('_', '-')
      type.common_names[new_key] = type.common_names[key]
      delete type.common_names[key]
    }
  }
  // TEMP: Generate USDA URL from symbol
  if (type.usda_symbol) {
    type.urls.usda = `https://plants.usda.gov/home/plantProfile?symbol=${type.usda_symbol}`
  }
  replaced.push('usda_symbol')
  // Format categories: {categories: [category, ...]}
  type.categories = _.unmask_bits(type.category_mask, TYPE_CATEGORIES)
  replaced.push('category_mask')
  // Drop replaced properties
  for (const key of replaced) {
    delete type[key]
  }
  return type
}

_.locale_to_name = function(locale) {
  const prefix = locale.toLowerCase().replace('-', '_')
  return `${prefix}_name`
}

_.deconstruct_type = function(type) {
  if (type.common_names) {
    // Extract English name and synonyms
    if ('en' in type.common_names) {
      type.en_name = type.common_names.en[0]
      type.en_synonyms = type.common_names.en.slice(1).join(', ') || null
      delete type.common_names['en']
    }
  }
  if (type.scientific_names) {
    type.scientific_name = type.scientific_names[0]
    type.scientific_synonyms = type.scientific_names.slice(1).join(', ') || null
    delete type.scientific_names
  }
  if (type.categories) {
    type.category_mask = _.mask_bits(type.categories, TYPE_CATEGORIES)
    delete type.categories
  }
  return type
}

_.format_location = function(location) {
  // TEMP: Replace no_season=true with season=[0, 11]
  if (location.no_season) {
    location.season_start = 0
    location.season_stop = 11
  }
  delete location.no_season
  return location
}

_.format_user = function(user) {
  if (user.range) {
    user.range = JSON.parse(user.range)
  }
  return user
}

_.is_date_in_future = function(datestamp) {
  // Compare date to current date + 1 day (accounting for timezones)
  const date = new Date(datestamp)
  date.setUTCHours(0, 0, 0, 0)
  const today = new Date()
  today.setUTCHours(0,0,0,0)
  today.setDate(today.getDate() + 1)
  return date > today
}

/**
 * Check if value should be considered null (empty).
 *
 * @param {*} value - Value to check.
 * @param {*} zero - Whether to consider zero as null.
 * @returns {boolean} Whether value is null.
 * @example
 * is_null(null)  // true
 * is_null(undefined)  // true
 * is_null('')  // true
 * is_null('a')  // false
 * is_null(0)  // false
 * is_null(0, true)  // true
 * is_null(1)  // false
 * is_null([])  // true
 * is_null([0])  // false
 * is_null({})  // true
 * is_null({a: 0})  // false
 */
_.is_null = function(value, zero = false) {
  if (Array.isArray(value)) {
    return value.length == 0
  } else if (Object.prototype.toString.call(value) === '[object Object]') {
    return Object.keys(value).length == 0
  } else {
    const nulls = ['', null, undefined]
    if (zero) {
      nulls.push(0)
    }
    return nulls.includes(value)
  }
}

// /**
//  * Hash text using SHA256.
//  *
//  * Always produces a string that is 256 bits (32 bytes) long.
//  * In base64, that is ceil(32/3) * 4 = 44 bytes, under the bcrypt 72 byte limit.
//  *
//  * @param {*} text
//  * @returns
//  */
// function sha256(text) {
//   return crypto.createHash("sha256").update(text).digest("base64")
// }

/**
 * Compare password to password hash.
 *
 * bcrypt truncates the input to 72 bytes, so the first 72 bytes of a password
 * would pass. To prevent this, we could prehash the password with sha256.
 * See https://security.stackexchange.com/q/6623.
 *
 * @param {*} password
 * @param {*} hash
 * @returns
 */
_.compare_password = function(password, hash) {
  return bcrypt.compare(password, hash)
}

_.hash_password = function(password) {
  return bcrypt.hash(password, 10)
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

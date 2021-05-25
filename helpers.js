const yaml = require('yaml')
const fs = require('fs')
const s3 = yaml.parse(fs.readFileSync('s3.yml', 'utf8'))

var _ = {}

const EARTH_RADIUS = 6378137  // m
const EARTH_CIRCUMFERENCE = 2 * Math.PI * EARTH_RADIUS  // m
const MAX_LATITUDE = 85.0511  // degrees

/**
 * Point coordinates.
 * 
 * @typedef {object} Point
 * @property {number} x - Easting (m) or longitude (degrees).
 * @property {number} y - Northing (m) or latitude (degrees).
 */

/**
 * Parse point coordinates.
 * 
 * @param {string} value - Coordinates in the format 'lat,lng' (WGS84 decimal degrees).
 * Expects longitude in interval [-180, 180] and latitude in interval [-90, 90].
 * @param {boolean} [mercator=false] - Whether to limit latitude to Web Mercator
 * interval [-85.0511, 85.0511].
 * @returns {Point} Parsed point in WGS84 decimal degrees.
 */
_.parse_point = function(value, mercator = false) {
  const latlng = value.split(',').map(parseFloat)
  if (latlng.length != 2) {
    throw Error('Coordinates not in the format {latitude},{longitude}')
  }
  const point = {x: latlng[1], y: latlng[0]}
  const max = {x: 180, y: mercator ? MAX_LATITUDE : 90}
  if (Math.abs(point.x) > max.x) {
    throw Error(`Longitude not in the interval [-${max.x}, ${max.x}]`)
  }
  if (Math.abs(point.y) > max.y) {
    throw Error(`Latitude not in the interval [-${max.y}, ${max.y}]`)
  }
  return point
}

/**
 * Parse bounding box coordinates.
 * 
 * @param {string} value - Bounds in the format 'swlat,swlng|nelat,nelng'
 * (WGS84 decimal degrees).
 * @param {boolean} [mercator=false] - Whether to limit latitude to Web Mercator
 * interval [-85.0511, 85.0511].
 * @returns {Point[]} Parsed points in WGS84 decimal degrees.
 */
 _.parse_bounds = function(value, mercator = false) {
  const points = value.split('|').map(x => _.parse_point(x, mercator))
  if (points.length != 2) {
    throw Error('Bounds not in the format {lat},{lng}|{lat},{lng}')
  }
  return points
}

/**
 * Convert bounding box to SQL condition.
 * 
 * @param {Point[]} bounds - Bounding box (WGS84).
 * @param {boolean} mercator - Whether to use filter on `location` (WGS84 geometry) 
 * or `x` and `y` (cached mercator coordinates).
 * @returns {string} SQL condition.
 */
_.bounds_to_sql = function(bounds, mercator = false) {
  var {x, y} = {x: 'lng', y: 'lat'}
  if (mercator) {
    var {x, y} = {x: 'x', y: 'y'}
    bounds = bounds.map(wgs84_to_mercator)
  }
  const operator = bounds[1].x > bounds[0].x ? 'AND' : 'OR'
  return (
    `(${x} > ${bounds[0].x} ${operator} ${x} < ${bounds[1].x}) AND ` +
    `(${y} > ${bounds[0].y} AND ${y} < ${bounds[1].y})`
  )
}

/**
 * Transform point from WGS84 to Web Mercator.
 * 
 * @param {Point} point - Point (WGS84) with latitude in interval [-85.0511, 85.0511].
 * @returns {Point} Point (Web Mercator).
 */
const wgs84_to_mercator = function(point) {
  if (Math.abs(point.y) > MAX_LATITUDE) {
    throw Error(`Latitude not in the interval [-${MAX_LATITUDE}, ${MAX_LATITUDE}]`)
  }
  return {
    x: (point.x / 360) * EARTH_CIRCUMFERENCE,
    y: Math.log(Math.tan((point.y + 90) * (Math.PI / 360))) * EARTH_RADIUS
  }
}

_.zoom_to_sql = function(value) {
  const zoom = parseInt(value)
  if (zoom < 0 || zoom > 13) {
    throw Error('Zoom not in interval [0, 13]')
  }
  return `zoom = ${zoom}`
}

_.muni_to_sql = function(value) {
  if (value == 'false') {
    return 'NOT muni'
  }
}

_.types_to_sql = function(value) {
  // '1,2,3'
  if (value) {
    return `type_id IN (${value})`
  }
}

_.types_array_to_sql = function(value) {
  // '1,2,3'
  if (value) {
    return `type_ids && ARRAY[${value}]`
  }
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
  for (let key in type) {
    if (key == 'scientific_name') {
      continue
    }
    if (key.endsWith('_name')) {
      replaced.push(key)
      if (type[key]) {
        type.common_names[key.replace('_name', '')] = type[key].split(' / ')
      }
    } else if (key.endsWith('_url')) {
      replaced.push(key)
      if (type[key]) {
        type.urls[key.replace('_url', '')] = type[key]
      }
    }
  }
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
  // TEMP: Generate USDA URL from symbol
  if (type.usda_symbol) {
    type.urls.usda = `https://plants.usda.gov/java/profile?symbol=${type.usda_symbol}`
  }
  replaced.push('usda_symbol')
  // Drop replaced properties
  for (let key of replaced) {
    delete type[key]
  }
  return type
}

// rails paperclip paths are :bucket/observations/photos/:a/:b/:c/medium|thumb|original/whatever.jpg
// :a/:b/:c is from this function and is based on the observation.id
const partition_id = function(id) {
  const s = String(id).padStart(9, '0')
  return [s.substr(0, 3), s.substr(3, 3), s.substr(6, 3)].join('/')
}

_.build_photo_urls = function(id, filename) {
  const base = `https://${s3.host}/${s3.bucket}/observations/photos/${partition_id(id)}`
  return {
    thumb: `${base}/thumb/${filename}`,
    medium: `${base}/medium/${filename}`,
    original: `${base}/original/${filename}`
  }
}

_.format_review = function(review) {
  // TEMP: Move old-style photo to photos array
  review.photos = []
  if (review.photo_file_name) {
    review.photos.push(_.build_photo_urls(review.id, review.photo_file_name))
  }
  delete review.photo_file_name
  return review
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

module.exports = _

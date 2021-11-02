require('dotenv').config()
const fs = require('fs')
const path = require('path')
const aws = require('aws-sdk')
const s3 = new aws.S3({
  region: process.env.S3_REGION,
  accessKeyId: process.env.S3_ACCESS_KEY_ID,
  secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
  apiVersion: '2006-03-01'
})
const sharp = require('sharp')

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

_.format_location = function(location) {
  // TEMP: Replace no_season=true with season=[0, 11]
  if (location.no_season) {
    location.season_start = 0
    location.season_stop = 11
  }
  delete location.no_season
  return location
}

const resize_photo = function(input, output, size = null) {
  return sharp(input)
    // https://sharp.pixelplumbing.com/api-resize#resize
    .resize({width: size, height: size, fit: 'inside', withoutEnlargement: true})
    .rotate()
    .withMetadata()
    // Convert to JPEG
    .jpeg()
    .toFile(output)
}

const upload_photo = function(input, output) {
  return s3.upload({
    ACL: 'public-read',
    Bucket: process.env.S3_BUCKET,
    Body: fs.createReadStream(input),
    Key: output,
    ContentType: 'image/jpeg'
  }).promise()
}

const resize_and_upload_photo = async function(input) {
  sizes = {
    thumb: 100,
    medium: 300,
    original: null
  }
  const promises = []
  for (const style in sizes) {
    const job = async function() {
      const resized = `${input}-${style}.jpg`
      await resize_photo(input, resized, sizes[style])
      const output = path.join('photos', path.basename(input), `${style}.jpg`)
      const upload = await upload_photo(resized, output, 'image/jpeg')
      await fs.promises.unlink(resized)
      return upload.Location
    }
    promises.push(job())
  }
  const urls = await Promise.all(promises)
  await fs.promises.unlink(input)
  return Object.fromEntries(Object.keys(sizes).map((k, i) => [k, urls[i]]))
}

_.resize_and_upload_photos = function(inputs) {
  const promises = []
  for (const input of inputs) {
    promises.push(resize_and_upload_photo(input))
  }
  return Promise.all(promises)
}

module.exports = _

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
const postmark = require('postmark')
const postmark_client = new postmark.ServerClient(process.env.POSTMARK_API_TOKEN)
const bcrypt = require('bcrypt')
const crypto = require('crypto')

const _ = {}

const EARTH_RADIUS = 6378137  // m
const EARTH_CIRCUMFERENCE = 2 * Math.PI * EARTH_RADIUS  // m
const MAX_LATITUDE = 85.0511  // degrees
const MAX_GRID_ZOOM = 14

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
_.bounds_to_sql = function(
  bounds, { geography = null, epsg = 4326, mercator = false } = {}
) {
  var {x, y} = {x: 'lng', y: 'lat'}
  if (mercator) {
    var {x, y} = {x: 'x', y: 'y'}
    bounds = bounds.map(_.wgs84_to_mercator)
  }
  if (geography) {
    return (
      `${geography} && ST_MakeEnvelope(` +
      `${bounds[0].x}, ${bounds[0].y}, ${bounds[1].x}, ${bounds[1].y}, ${epsg})`
    )
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
_.wgs84_to_mercator = function({x, y}) {
  if (Math.abs(y) > MAX_LATITUDE) {
    throw Error(`Latitude not in the interval [-${MAX_LATITUDE}, ${MAX_LATITUDE}]`)
  }
  return {
    x: (x / 360) * EARTH_CIRCUMFERENCE,
    y: Math.log(Math.tan((y + 90) * (Math.PI / 360))) * EARTH_RADIUS
  }
}

_.zoom_to_sql = function(value) {
  const zoom = parseInt(value)
  if (zoom < 0 || zoom > MAX_GRID_ZOOM) {
    throw Error(`Zoom not in interval [0, ${MAX_GRID_ZOOM}]`)
  }
  return `zoom = ${zoom}`
}

_.muni_to_sql = function(value) {
  if (value == 'false') {
    return 'NOT muni'
  }
}

_.invasive_to_sql = function(value) {
  if (value == 'true') {
    return 'invasive'
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
    // Sorting shown to reduce db time 4x (?!). Requires intarray extension.
    return `type_ids && sort(ARRAY[${value}])`
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
  for (const key in type) {
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
    type.urls.usda = `https://plants.usda.gov/home/plantProfile?symbol=${type.usda_symbol}`
  }
  replaced.push('usda_symbol')
  // Drop replaced properties
  for (const key of replaced) {
    delete type[key]
  }
  return type
}

_.deconstruct_type = function(type) {
  // TODO: Handle additional locales
  if (type.common_names) {
    if ('en' in type.common_names) {
      type.en_name = type.common_names.en[0]
      type.en_synonyms = type.common_names.en.slice(1).join(', ')
    }
    delete type.common_names
  }
  if (type.scientific_names) {
    type.scientific_name = type.scientific_names[0]
    type.scientific_synonyms = type.scientific_names.slice(1).join(', ')
    delete type.scientific_names
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

async function resize_photo(input, output, size = null) {
  const image = sharp(input)
  const metadata = await image.metadata()
  if (metadata.format === 'jpeg' && metadata.width <= size && metadata.height <= size) {
    return input
  }
  await image
    // https://sharp.pixelplumbing.com/api-resize#resize
    .resize({width: size, height: size, fit: 'inside', withoutEnlargement: true})
    .rotate()
    .withMetadata()
    // Convert to JPEG
    .jpeg()
    .toFile(output)
  return output
}

function upload_photo(input, output) {
  return s3.upload({
    ACL: 'public-read',
    Bucket: process.env.S3_BUCKET,
    Body: fs.createReadStream(input),
    Key: output,
    ContentType: 'image/jpeg'
  }).promise()
}

// ---- For backwards compatibility only ----

function id_partition(id) {
  const pad = String(id).padStart(9, '0')
  return path.join(pad.substr(0, 3), pad.substr(3, 3), pad.substr(6, 3))
}

function build_s3_photo_keys(observation_id, filename = 'first.jpg') {
  const base = path.join('observations', 'photos', id_partition(observation_id))
  return {
    thumb: path.join(base, 'thumb', filename),
    medium: path.join(base, 'medium', filename),
    original: path.join(base, 'original', filename)
  }
}

function parse_s3_url(url) {
  const regex = /^https?:\/\/(?<bucket>[^\.]+)\.s3\.(?<region>[^\.]+)\.amazonaws\.com\/(?<key>.*)$/
  const match = regex.exec(url)
  if (match == null) {
    throw Error(`Photo URL not formatted as expected: ${url}`)
  }
  return match.groups
}

_.copy_photo_to_old_urls = function(urls, observation_id) {
  const keys = build_s3_photo_keys(observation_id)
  const promises = ['thumb', 'medium', 'original'].map(style => {
    const parsed = parse_s3_url(urls[style])
    return s3.copyObject({
      CopySource: `${parsed.bucket}/${parsed.key}`,
      Bucket: process.env.S3_BUCKET,
      Key: keys[style],
      ACL: 'public-read'
    }).promise()
  })
  return Promise.all(promises)
}

_.resize_and_upload_photo = async function(input) {
  sizes = {
    thumb: 100,
    medium: 300,
    original: 2048
  }
  const promises = []
  for (const style in sizes) {
    const job = async function() {
      const resized = `${input}-${style}.jpg`
      const to_upload = await resize_photo(input, resized, sizes[style])
      const output = path.join('photos', path.basename(input), `${style}.jpg`)
      const upload = await upload_photo(to_upload, output, 'image/jpeg')
      if (to_upload === resized) {
        await fs.promises.unlink(resized)
      }
      return upload.Location
    }
    promises.push(job())
  }
  const urls = await Promise.all(promises)
  await fs.promises.unlink(input)
  return Object.fromEntries(Object.keys(sizes).map((k, i) => [k, urls[i]]))
}


function send_email({to, subject, body, tag = null}) {
  return postmark_client.sendEmail({
    From: 'info@fallingfruit.org',
    To: to,
    Subject: subject,
    HtmlBody: body.replace(/\s{2,}/g, ''),
    MessageStream: 'outbound',
    Tag: tag
  })
}

_.send_email_confirmation = function(user, token) {
  const url = path.join(
    process.env.API_ORIGIN,
    process.env.API_BASE,
    'user',
    `confirmation?token=${token}`
  )
  const email = {
    to: user.email,
    // Phrase: devise.mailer.confirmation_instructions.subject
    subject: 'Confirmation instructions',
    // Phrase: users.mailer.confirmation_instructions_html
    body: `
      <p>Welcome to Falling Fruit,</p>
      <p>To activate your account, you must confirm your email (${user.email}) by visiting the link below:
      <br/>${url}</p>
      <p>Falling Fruit is powered by its users, so if you have the opportunity to add or improve it, please do so. Happy foraging!</p>
    `,
    tag: 'email-confirmation'
  }
  return send_email(email)
}

_.send_email_confirmation_exists = function(user) {
  const email = {
    to: user.email,
    subject: 'Registration attempt',
    body: `
      <p>Hello ${user.name || user.email},</p>
      <p>Someone (maybe you) tried to sign up using this email (${user.email}). If this was you, sign in here instead:
      <br/>https://fallingfruit.org/users/sign_in</p>
      <p>If you didn't request this, please ignore this email or contact us (info@fallingfruit.org) if you have questions.</p>
    `,
    tag: 'email-confirmation'
  }
  return send_email(email)
}

_.send_email_confirmation_not_found = function(user) {
  const email = {
    to: user.email,
    subject: 'Email confirmation attempt',
    body: `
      <p>Hello,</p>
      <p>Someone (possibly you) requested a link to confirm a Falling Fruit (https://fallingfruit.org) account. However, no account is associated with this email (${user.email}). If you made this request, please try again using a different email address:
      <br/>https://fallingfruit.org/users/confirmation/new</p>
      <p>If you didn't request this, please ignore this email or contact us (info@fallingfruit.org) if you have questions.</p>
    `,
    tag: 'email-confirmation'
  }
  return send_email(email)
}

_.send_email_confirmation_confirmed = function(user) {
  const email = {
    to: user.email,
    subject: 'Email already confirmed',
    body: `
      <p>Hello ${user.name || user.email},</p>
      <p>Someone (most likely you) requested a link to confirm your email (${user.email}). Your email is already confirmed, so you can simply sign in here:
      <br/>https://fallingfruit.org/users/sign_in</p>
      <p>If you didn't request this, please ignore this email or contact us (info@fallingfruit.org) if you have questions.</p>
    `,
    tag: 'email-confirmation'
  }
  return send_email(email)
}

_.send_password_reset = function(user, token) {
  const url = path.join(
    process.env.WEB_ORIGIN, 'password', `set?token=${token}`
  )
  const email = {
    to: user.email,
    // Phrase: devise.mailer.reset_password_instructions.subject
    subject: 'Reset password instructions',
    // Phrase: users.mailer.reset_password_instructions_html
    body: `
      <p>Hello ${user.name || user.email},</p>
      <p>Someone (most likely you) requested a link to change your password:
      <br/>${url}</p>
      <p>If you didn't request this, you can ignore this email. Your password won't change unless you visit the link above and create a new one.</p>
    `,
    tag: 'password-reset'
  }
  return send_email(email)
}

_.send_password_reset_not_found = function(user) {
  const email = {
    to: user.email,
    subject: 'Password reset attempt',
    body: `
      <p>Hello,</p>
      <p>Someone (possibly you) requested a link to change the password for a Falling Fruit (https://fallingfruit.org) account. However, no account is associated with this email (${user.email}). If you made this request, please try again using a different email address:
      <br/>https://fallingfruit.org/users/password/new</p>
      <p>If you didn't request this, please ignore this email or contact us (info@fallingfruit.org) if you have questions.</p>
    `,
    tag: 'password-reset'
  }
  return send_email(email)
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


// ---- Clusters ----

// /**
//  * Transform point from Web Mercator to WGS84.
//  *
//  * @param {Point} point - Point (Web Mercator).
//  * @returns {Point} Point (WGS84).
//  */
// function mercator_to_wgs84({x, y}) {
//   return {
//     x: x * (360 / EARTH_CIRCUMFERENCE),
//     y: 90 - (Math.atan2(1, Math.exp(y / EARTH_RADIUS)) * 360 / Math.PI)
//   }
// }

/**
 * Web Mercator (SRID 900913) to grid cell indices.
 */
 _.mercator_to_gridcell = function({x, y}, zoom = MAX_GRID_ZOOM) {
  const cell_size = EARTH_CIRCUMFERENCE / (2 ** zoom)
  // Move origin to bottom left corner
  // Convert to grid cell number
  return {
    x: Math.floor((x + EARTH_CIRCUMFERENCE / 2) / cell_size),
    y: Math.floor((y + EARTH_CIRCUMFERENCE / 2) / cell_size),
    zoom: zoom
  }
}

// /**
//  * Grid cell indices to Web Mercator (SRID 900913).
//  *
//  * Returns the lower left corner of the cell.
//  */
// function gridcell_to_mercator({x, y, zoom}) {
//   const cell_size = EARTH_CIRCUMFERENCE / (2 ** zoom)
//   // Move origin to center
//   return {
//     x: x * cell_size - (EARTH_CIRCUMFERENCE / 2),
//     y: y * cell_size - (EARTH_CIRCUMFERENCE / 2)
//   }
// }

_.gridcell_to_geohash = function({x, y, zoom}) {
  // if (x < 0 || x > 2 ** zoom - 1 || y < 0 || y > 2 ** zoom - 1) {
  //   throw Error('Grid indices must be in the range [0, 2 ** zoom)')
  // }
  // Convert to binary
  const xb = x.toString(2).padStart(zoom + 1, '0')
  const yb = y.toString(2).padStart(zoom + 1, '0')
  // Build hash
  let geohash = ''
  for (let i = 0; i < xb.length; i++) {
    geohash += xb[i] + yb[i]
  }
  return geohash
}

// function geohash_to_gridcell(geohash) {
//   // Expand hash to binary
//   let xb = ''
//   let yb = ''
//   for (let i = 0; i < geohash.length; i += 2) {
//     xb += geohash[i]
//     yb += geohash[i + 1]
//   }
//   // Convert to integer
//   return {
//     x: parseInt(xb, 2),
//     y: parseInt(yb, 2),
//     zoom: geohash_to_zoom(geohash)
//   }
// }

_.expand_geohash = function(geohash) {
  const geohashes = []
  for (let i = geohash.length; i > 0; i -= 2) {
    geohashes.push(geohash.substring(0, i))
  }
  return geohashes
}

_.geohash_to_zoom = function(geohash) {
  return (geohash.length / 2) - 1
}

function weighted_mean(values, weights) {
  const [value, weight] = values
    .map((value, i) => [value, weights[i]])
    .reduce(([value_sum, weight_sum], [value, weight]) => {
      return [value_sum + value * weight, weight_sum + weight]
    }, [0, 0])
  return value / weight
}

_.move_cluster = function({cx, cy}, n, {x, y}, add) {
  return {
    x: weighted_mean([cx, x], [n, add]),
    y: weighted_mean([cy, y], [n, add])
  }
}

_.set_equal = function(a, b) {
  return a.length === b.length && a.every(value => b.includes(value))
}

_.MAX_GRID_ZOOM = MAX_GRID_ZOOM

module.exports = _

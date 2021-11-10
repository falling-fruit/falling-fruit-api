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
const {ORIGIN, BASE, JWT_OPTIONS, JWT_EXPIRES_IN} = require('./constants')
const jwt = require('jsonwebtoken')
const postmark = require('postmark')
const { info } = require('console')
const postmark_client = new postmark.ServerClient(process.env.POSTMARK_API_TOKEN)
const bcrypt = require('bcrypt')
const crypto = require('crypto')

const _ = {}

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
function wgs84_to_mercator(point) {
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
    type.urls.usda = `https://plants.usda.gov/java/profile?symbol=${type.usda_symbol}`
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

function resize_photo(input, output, size = null) {
  return sharp(input)
    // https://sharp.pixelplumbing.com/api-resize#resize
    .resize({width: size, height: size, fit: 'inside', withoutEnlargement: true})
    .rotate()
    .withMetadata()
    // Convert to JPEG
    .jpeg()
    .toFile(output)
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

async function resize_and_upload_photo(input) {
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

_.sign_user_token = function(user) {
  return jwt.sign(
    {user: {id: user.id, roles: user.roles}},
    process.env.JWT_SECRET,
    {...JWT_OPTIONS, expiresIn: JWT_EXPIRES_IN}
  )
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

_.sha256_hmac = function(text) {
  const key = process.env.APP_SECRET
  return crypto.createHmac('sha256', key).update(text).digest('hex')
}

_.reset_password_token = function() {
  return crypto.randomBytes(32).toString('hex')
}

/**
 * Constant-time comparison.
 *
 * crypto.timingSafeEqual() requires buffers of the same length.
 * So it is skipped if they have different lengths.
 * See https://github.com/nodejs/node/issues/17178#issuecomment-348784606.
 */
_.safe_equal = function(x, y) {
  const xb = Buffer.from(x)
  const yb = Buffer.from(y)
  return xb.length === yb.length && crypto.timingSafeEqual(xb, yb)
}

_.email_confirmation_url = function(id, expires) {
  const url = `${ORIGIN}${BASE}/user/confirmation?id=${id}&expires=${expires}`
  const signature = _.sha256_hmac(url) // 256 bits = 32 bytes, 32 * 2 = 64 chars
  return `${url}&signature=${signature}`
}

_.send_email_confirmation = function(user) {
  const expires = Date.now() + 1000 * 86400 // 1 day
  const url = _.email_confirmation_url(user.id, expires)
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

_.send_password_reset = function(user, token) {
  const url = `${ORIGIN}${BASE}/password?id=${user.id}&token=${token}`
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

/**
 * Hash text using SHA256.
 *
 * Always produces a string that is 256 bits (32 bytes) long.
 * In base64, that is ceil(32/3) * 4 = 44 bytes, under the bcrypt 72 byte limit.
 *
 * @param {*} text
 * @returns
 */
function sha256(text) {
  return crypto.createHash("sha256").update(text).digest("base64")
}

/**
 * Compare password to password hash.
 *
 * bcrypt truncates the input to 72 bytes, so the first 72 bytes of a password
 * would pass. To prevent this, we prehash the password.
 * See https://security.stackexchange.com/q/6623.
 *
 * @param {*} password
 * @param {*} hash
 * @returns
 */
_.compare_password = function(password, hash) {
  return bcrypt.compare(sha256(password), hash)
}

_.hash_password = function(password) {
  return bcrypt.hash(sha256(password), 10)
}

module.exports = _

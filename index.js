require('dotenv').config()
const db = require('./db')
const _ = require('./helpers')
const middleware = require('./middleware')
const {PORT, ORIGIN, BASE, JWT_EXPIRES_IN} = require('./constants')
const express = require('express')
const cors = require('cors')
const multer = require('multer')
const uploads = multer({ dest: 'uploads' })
const compression = require('compression')
const bcrypt = require('bcrypt')

// Configuration
const app = express()
app.use(compression())
app.use(cors())
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Pre-route middleware
app.use((req, res, next) => {
  const skip_api_key = [
    // OpenAPI OAuth2 password flow
    `${BASE}/user/token`,
    // Email confirmation link
    `${BASE}/user/confirmation`
  ]
  if (skip_api_key.includes(req.path)) {
    return next()
  }
  return middleware.check_api_key(req, res, next)
})

// Routes: Docs
app.use(BASE, express.static('docs'))

// Routes: Clusters
get(`${BASE}/clusters`, req => db.clusters.list(req.query))

// Routes: Types
get(`${BASE}/types`, () => db.types.list())
// TODO: Raise auth error if pending: false and not admin
post(`${BASE}/types`, req => db.types.add(req.body))
get(`${BASE}/types/counts`, req => db.types.count(req.query))
get(`${BASE}/types/:id`, req => db.types.show(req.params.id))

// Routes: Locations
get(`${BASE}/locations`, req => db.locations.list(req.query))
post(
  `${BASE}/locations`,
  middleware.authenticate(),
  async req => {
    // TODO: Perform within transaction (https://stackoverflow.com/a/43800783)
    const user_id = req.user ? req.user.id : null
    let photos
    if (req.body.review) {
      photos = await db.photos.test_not_assigned(req.body.review.photo_ids)
    }
    const location = await db.locations.add({...req.body, user_id: user_id})
    if (req.body.review) {
      const review = await db.reviews.add(
        location.id, {...req.body.review, user_id: user_id}
      )
      await db.photos.assign(req.body.review.photo_ids, review.id)
      review.photos = photos
      location.reviews = [review]
    }
    return location
  }
)
get(`${BASE}/locations/count`, req => db.locations.count(req.query))
get(`${BASE}/locations/:id`, async req => {
  const location = await db.locations.show(req.params.id)
  if (req.query.embed) {
    const embedded = req.query.embed.split(',')
    if (embedded.includes('reviews')) {
      location.reviews = await db.reviews.list(req.params.id)
    }
    if (embedded.includes('import') && location.import_id) {
      location.import = await db.imports.show(location.import_id)
      delete location.import_id
    }
  }
  return location
})
put(`${BASE}/locations/:id`, req => db.locations.edit(req.params.id, req.body))

// Routes: Reviews
get(`${BASE}/locations/:id/reviews`, req => db.reviews.list(req.params.id))
post(
  `${BASE}/locations/:id/reviews`,
  middleware.authenticate(),
  async req => {
    // TODO: Perform within transaction (https://stackoverflow.com/a/43800783)
    const photos = await db.photos.test_not_assigned(req.body.photo_ids)
    const review = await db.reviews.add(
      req.params.id, {...req.body, user_id: req.user ? req.user.id : null}
    )
    await db.photos.assign(req.body.photo_ids, review.id)
    review.photos = photos
    return review
  }
)
get(`${BASE}/reviews/:id`, req => db.reviews.show(req.params.id))
put(
  `${BASE}/reviews/:id`,
  middleware.authenticate('user'),
  async (req, res) => {
    // Restrict to linked user
    const review = await db.reviews.show(req.params.id)
    if (req.user.id != review.user_id) {
      return void res.status(403).json({error: 'Insufficient permissions'})
    }
    return db.reviews.edit(req.params.id, req.body)
  }
)

// Routes: Photos
post(
  `${BASE}/photos`,
  uploads.single('file'),
  async req => {
    const urls = await _.resize_and_upload_photo(req.file.path)
    return db.photos.add(urls)
  }
)

// Routes: Users
post(`${BASE}/user`, async (req) => {
  // Email uniqueness is case-insensitive
  req.body.email = req.body.email.toLowerCase()
  const exists = await db.oneOrNone(
    'SELECT email FROM users WHERE email=${email}', {email: req.body.email}
  )
  if (exists) {
    throw Error('An account with that email already exists')
  }
  const user = await db.users.add(req)
  // Send confirmation email
  await _.send_email_confirmation(user)
  // Phrase: devise.confirmations.send_instructions
  return {message: 'You will receive an email with instructions for how to confirm your email address in a few minutes'}
})
get(
  `${BASE}/user`,
  middleware.authenticate('user'),
  (req) => db.users.show(req.user.id)
)
put(
  `${BASE}/user`,
  middleware.authenticate('user'),
  (req) => db.users.edit(req)
)
post(`${BASE}/user/token`, uploads.none(), async (req, res) => {
  let user
  try {
    user = await db.one(
      'SELECT id, roles, encrypted_password, confirmed_at FROM users WHERE email = ${email}',
      {email: req.body.username.toLowerCase()}
    )
  } catch (err) {
    // Email not found
    // Phrase: devise.failure.invalid
    return void res.status(401).json({error: 'Invalid email or password'})
  }
  if (!user.confirmed_at) {
    // Phrase: devise.failure.unconfirmed
    throw Error('You have to confirm your email address before continuing')
  }
  if (!await _.compare_password(req.body.password, user.encrypted_password)) {
    // Wrong password
    // Phrase: devise.failure.invalid
    return void res.status(401).json({error: 'Invalid email or password'})
  }
  return void res.status(200).set({
    'cache-control': 'no-store'
  }).json({
    access_token: _.sign_user_token(user),
    token_type: 'bearer',
    expires_in: JWT_EXPIRES_IN
  })
})

// Routes: User email
get(`${BASE}/user/confirmation`, async (req) => {
  const id = Number(req.query.id)
  const expires = Number(req.query.expires)
  const expected = _.email_confirmation_url(id, expires)
  const actual = `${ORIGIN}${req.originalUrl}`
  if (!_.safe_equal(expected, actual)) {
    throw Error('Confirmation link is not valid')
  }
  if (expires <= Date.now()) {
    // Phrase: devise.errors.messages.expired
    throw Error('Confirmation link has expired, please request a new one')
  }
  const user = await db.oneOrNone(
    'SELECT confirmed_at FROM users WHERE id=${id}', {id: id}
  )
  if (!user) {
    // Phrase: devise.errors.messages.not_found
    throw Error('Email not found')
  }
  if (user.confirmed_at) {
    // Phrase: devise.errors.messages.already_confirmed
    throw Error('Email was already confirmed, please try signing in')
  }
  await db.users.confirm(id)
  // Phrase: devise.confirmation.confirmed
  return {message: 'Your email address has been successfully confirmed'}
})
post(`${BASE}/user/confirmation/retry`, async (req) => {
  const email = req.body.email.toLowerCase()
  const user = await db.oneOrNone(
    'SELECT id, email, confirmed_at FROM users WHERE email=${email}',
    {email: email}
  )
  if (!user) {
    // Phrase: devise.errors.messages.not_found
    throw Error('Email not found')
  }
  if (user.confirmed_at) {
    // Phrase: devise.errors.messages.already_confirmed
    throw Error('Email was already confirmed, please try signing in')
  }
  await _.send_email_confirmation(user)
  // Phrase: devise.confirmation.send_instructions
  return {message: 'You will receive an email with instructions for how to confirm your email address in a few minutes'}
})

// Routes: User password
put(`${BASE}/user/password`, async (req, res) => {
  const id = Number(req.query.id)
  const token = String(req.query.token)
  const user = await db.oneOrNone(
    'SELECT reset_password_token, reset_password_sent_at FROM users WHERE id=${id}',
    {id: id}
  )
  if (!user) {
    throw Error(`User with id=${id} not found`)
  }
  if (!user.reset_password_token) {
    return void res.status(401).json({error: 'Reset password token is invalid'})
  }
  if (!_.safe_equal(user.reset_password_token, _.sha256_hmac(token))) {
    return void res.status(401).json(
      {error: 'Invalid (or expired) password reset link. Make sure to use the link from the most recent password reset email'}
    )
  }
  const hours = (Date.now() - user.reset_password_sent_at) / (1000 * 3600)
  if (hours > 12) {
    return void res.status(401).json('Expired password reset link. Please request a new one')
  }
  await db.users.set_password(id, req.body.password)
  // Phrase: devise.passwords.updated_not_active
  return {message: 'Your password has been changed successfully'}
})
post(`${BASE}/user/password/reset`, async (req) => {
  const email = req.body.email.toLowerCase()
  const user = await db.oneOrNone(
    'SELECT id, email, name, confirmed_at FROM users WHERE email=${email}',
    {email: email}
  )
  if (!user) {
    // Phrase: devise.errors.messages.not_found
    throw Error('Email not found')
  }
  const token = await db.users.reset_password(user.id)
  await _.send_password_reset(user, token)
  // Phrase: devise.passwords.send_instructions
  return {message: 'You will receive an email with instructions on how to reset your password in a few minutes'}
})

// Routes: Reports
post(`${BASE}/reports`, middleware.authenticate(), async (req) => {
  if (req.user) {
    req.body.reporter_id = req.user.id
    if (!req.body.email || !req.body.name) {
      const user = await db.one(
        'SELECT name, email FROM users WHERE id=${id}', {id: req.user.id}
      )
      req.body.email = req.body.email || user.email
      req.body.name = req.body.name || user.name
    }
  }
  if (!req.body.email) {
    throw Error('An email is required')
  }
  return db.reports.add(req.body)
})

// Routes: Imports
get(`${BASE}/imports`, () => db.imports.list())
get(`${BASE}/imports/:id`, req => db.imports.show(req.params.id))

// Generic handlers
function register_route(method, url, handlers) {
  const middleware = handlers.slice(0, -1)
  const handler = handlers[handlers.length - 1]
  app[method](url, ...middleware, async (req, res, next) => {
    try {
      const data = await handler(req, res, next)
      if (data) {
        return void res.status(200).json(data)
      }
    } catch (err) {
      console.log('[caught]', err || err.message)
      return void res.status(400).json({
        error: err.message || err
      })
    }
  })
}

function get(url, ...handlers) {
  register_route('get', url, handlers)
}

function post(url, ...handlers) {
  register_route('post', url, handlers)
}

function put(url, ...handlers) {
  register_route('put', url, handlers)
}

// Start server
app.listen(PORT, () => {
    console.log('Ready for requests on http://localhost:' + PORT)
})

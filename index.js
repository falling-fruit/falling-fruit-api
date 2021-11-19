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
const tokenizer = new (require('./tokens'))()

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
      photos = await db.photos.test_unlinked(req.body.review.photo_ids)
    }
    const location = await db.locations.add({...req.body, user_id: user_id})
    if (req.body.review) {
      const review = await db.reviews.add(
        location.id, {...req.body.review, user_id: user_id}
      )
      await db.photos.link(req.body.review.photo_ids, review.id)
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
    const photos = await db.photos.test_unlinked(req.body.photo_ids)
    const review = await db.reviews.add(
      req.params.id, {...req.body, user_id: req.user ? req.user.id : null}
    )
    await db.photos.link(req.body.photo_ids, review.id)
    review.photos = photos
    return review
  }
)
get(`${BASE}/reviews/:id`, async (req) => {
  const review = await db.reviews.show(req.params.id)
  review.photos = await db.photos.list(req.params.id)
  return review
})
put(
  `${BASE}/reviews/:id`,
  middleware.authenticate('user'),
  async (req, res) => {
    const original = await db.reviews.show(req.params.id)
    // Restrict to linked user
    if (req.user.id != original.user_id) {
      return void res.status(403).json({error: 'Insufficient permissions'})
    }
    // TODO: Perform within transaction (https://stackoverflow.com/a/43800783)
    const photos = await db.photos.test_unlinked(req.body.photo_ids, original.id)
    const review = await db.reviews.edit(req.params.id, req.body)
    await db.photos.link(req.body.photo_ids, review.id)
    review.photos = photos
    return review
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
  const token = tokenizer.sign_email_confirmation(user)
  await _.send_email_confirmation(user, token)
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
  async (req, res) => {
    const user = await db.one(
      'SELECT id, name, encrypted_password, email FROM users WHERE id = ${id}',
      {id: req.user.id}
    )
    if (req.body.email != user.email || req.body.password) {
      // Require password confirmation
      if (!req.body.password_confirmation) {
        return void res.status(401).json(
          {error: 'Current password is required to change email or password'}
        )
      }
      const confirmed = await _.compare_password(
        req.body.password_confirmation, user.encrypted_password
      )
      if (!confirmed) {
        return void res.status(401).json({error: 'Wrong password'})
      }
      if (req.body.email != user.email) {
        // Check that email is not already taken
        const other = await db.oneOrNone('SELECT id FROM users WHERE email = ${email}', {email: req.body.email})
        if (other) {
          throw Error('An account with that email already exists')
        }
        // Save new email as unconfirmed
        await db.none(
          'UPDATE users SET unconfirmed_email = ${email} WHERE id = ${id}',
          {id: req.user.id, email: req.body.email}
        )
        // Send confirmation email
        const token = tokenizer.sign_email_confirmation(user, req.body.email)
        await _.send_email_confirmation({email: req.body.email}, token)
        // When email clicked: set unconfirmed_email to email
      }
      if (req.body.password === req.body.password_confirmation) {
        // Ignore password input
        req.body.password = null
      } else {
        // Revoke all existing tokens except the one in use
        await db.none(
          'DELETE FROM refresh_tokens WHERE user_id = ${id} AND jti != ${jti}',
          {id: req.user.id, jti: req.user.jti}
        )
      }
    }
    return db.users.edit(req)
  }
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
  const [tokens, jti, exp] = tokenizer.sign_and_wrap_access(user)
  // Store refresh token id in database
  await db.none(
    'INSERT INTO refresh_tokens (user_id, jti, exp) VALUES (${user_id}, ${jti}, ${exp})',
    {user_id: user.id, jti: jti, exp: exp}
  )
  return void res.status(200).set({'cache-control': 'no-store'}).json(tokens)
})
post(`${BASE}/user/token/refresh`, uploads.none(), async (req, res) => {
  // req.body.grant_type=refresh_token
  const token = req.body.refresh_token
  const data = tokenizer.verify_refresh(token, res)
  if (!data) {
    return
  }
  // Fetch user roles
  const user = await db.oneOrNone(
    'SELECT id, roles FROM users WHERE id = ${id}', {id: data.id}
  )
  if (!user) {
    return void res.status(401).json({error: 'Invalid refresh token'})
  }
  // Generate new refresh token with same expiration
  const [tokens, jti, exp] = tokenizer.sign_and_wrap_access(user, data.exp)
  // Replace with new refresh token if old refresh token exists
  const refreshed = await db.oneOrNone(
    'UPDATE refresh_tokens SET jti = ${new} WHERE user_id = ${user_id} AND jti = ${old} RETURNING jti',
    {user_id: user.id, old: data.jti, new: jti}
  )
  if (!refreshed) {
    return void res.status(401).json({error: 'Invalid refresh token'})
  }
  return void res.status(200).set({'cache-control': 'no-store'}).json(tokens)
})
drop(
  `${BASE}/user`,
  middleware.authenticate('user'),
  async (req, res) => {
    // // Check password
    // const user = await db.one(
    //   'SELECT encrypted_password FROM users WHERE id = ${id}',
    //   {id: req.user.id}
    // )
    // if (!await _.compare_password(req.body.password, user.encrypted_password)) {
    //   return void res.status(401).json({error: 'Wrong password'})
    // }
    await db.users.delete(req.user.id)
    return void res.status(204).send()
  }
)

// Routes: User email
get(`${BASE}/user/confirmation`, async (req, res) => {
  const token = req.query.token
  const data = tokenizer.verify_email_confirmation(token, res)
  if (!data) {
    return
  }
  const user = await db.oneOrNone(
    'SELECT id, email, confirmed_at, unconfirmed_email FROM users WHERE id=${id}',
    {id: data.id}
  )
  if (!user) {
    // Phrase: devise.errors.messages.not_found
    throw Error('Email not found')
  }
  if (user.unconfirmed_email) {
    if (user.unconfirmed_email === data.email) {
      // Confirm unconfirmed email
      await db.none(
        'UPDATE users SET email = unconfirmed_email, unconfirmed_email = NULL WHERE id = ${id}',
        {id: user.id}
      )
      return {message: 'Your email address has been successfully confirmed'}
    } else {
      throw Error('Email-confirmation token is not for the newest email on your account')
    }
  }
  if (user.confirmed_at) {
    // Phrase: devise.errors.messages.already_confirmed
    throw Error('Email was already confirmed, please try signing in')
  }
  await db.users.confirm(user.id)
  // Phrase: devise.confirmation.confirmed
  return {message: 'Your email address has been successfully confirmed'}
})
post(`${BASE}/user/confirmation`, async (req, res) => {
  const token = req.body.token
  const data = tokenizer.verify_email_confirmation(token, res)
  if (!data) {
    return
  }
  const user = await db.oneOrNone(
    'SELECT id, email, confirmed_at, unconfirmed_email FROM users WHERE id=${id}',
    {id: data.id}
  )
  if (!user) {
    // Phrase: devise.errors.messages.not_found
    throw Error('Email not found')
  }
  if (user.unconfirmed_email) {
    if (user.unconfirmed_email === data.email) {
      // Confirm unconfirmed email
      await db.none(
        'UPDATE users SET email = unconfirmed_email, unconfirmed_email = NULL WHERE id = ${id}',
        {id: user.id}
      )
      return {email: user.unconfirmed_email}
    } else {
      throw Error('Email-confirmation token does not match the newest email on your account')
    }
  }
  if (user.confirmed_at) {
    // Phrase: devise.errors.messages.already_confirmed
    throw Error('Email was already confirmed, please try signing in')
  }
  await db.users.confirm(user.id)
  // Phrase: devise.confirmation.confirmed
  return {email: user.email}
})
post(`${BASE}/user/confirmation/retry`, async (req) => {
  const email = req.body.email.toLowerCase()
  const user = await db.oneOrNone(
    'SELECT id, email, unconfirmed_email, confirmed_at FROM users WHERE email = ${email} OR unconfirmed_email = ${email}',
    {email: email}
  )
  if (!user) {
    // Phrase: devise.errors.messages.not_found
    throw Error('Email not found')
  }
  if (user.email === email && user.confirmed_at) {
    // Phrase: devise.errors.messages.already_confirmed
    throw Error('Email was already confirmed, please try signing in')
  }
  const token = tokenizer.sign_email_confirmation(user, user.unconfirmed_email ? user.unconfirmed_email : null)
  await _.send_email_confirmation({email: email}, token)
  // Phrase: devise.confirmation.send_instructions
  return {message: 'You will receive an email with instructions for how to confirm your email address in a few minutes'}
})

// Routes: User password
put(`${BASE}/user/password`, async (req, res) => {
  const token = req.body.token
  let data = tokenizer.decode_password_reset(token, res)
  if (!data) {
    return
  }
  const user = await db.oneOrNone(
    'SELECT id, email, encrypted_password FROM users WHERE id=${id}', {id: data.id}
  )
  if (!user) {
    throw Error('Account not found')
  }
  data = tokenizer.verify_password_reset(token, user.encrypted_password, res)
  if (!data) {
    return
  }
  await db.users.set_password(user.id, req.body.password)
  // Phrase: devise.passwords.updated_not_active
  // return {message: 'Your password has been changed successfully'}
  return {email: user.email}
})
post(`${BASE}/user/password/reset`, async (req) => {
  const email = req.body.email.toLowerCase()
  const user = await db.oneOrNone(
    'SELECT id, email, name, confirmed_at, encrypted_password FROM users WHERE email=${email}',
    {email: email}
  )
  if (!user) {
    // Phrase: devise.errors.messages.not_found
    throw Error('Email not found')
  }
  const token = tokenizer.sign_password_reset(user, user.encrypted_password)
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

// delete is a reserved word
function drop(url, ...handlers) {
  register_route('delete', url, handlers)
}

// Start server
app.listen(PORT, () => {
    console.log('Ready for requests on http://localhost:' + PORT)
})

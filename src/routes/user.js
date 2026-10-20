const db = require('../db')
const _ = require('../helpers')
const middleware = require('../middleware')
const multer = require('multer')
const uploads = multer({ dest: 'uploads' })
const tokenizer = new (require('../tokens'))()
const makeRouter = require('./makeRouter')

const { router, get, post, put, drop } = makeRouter()

// Routes: Users (private)
post(
  '/',
  middleware.recaptcha,
  async (req) => {
    // Email uniqueness is case-insensitive
    req.body.email = req.body.email.toLowerCase()
    const exists = await db.oneOrNone(
      'SELECT email, name FROM users WHERE email=${email}', {email: req.body.email}
    )
    if (exists) {
      await _.send_email_confirmation_exists(exists)
    } else {
      const user = await db.users.add(req)
      // Send confirmation email
      const token = tokenizer.sign_email_confirmation(user)
      await _.send_email_confirmation(user, token)
    }
    // Phrase: devise.confirmations.send_instructions
    return {message: 'You will receive an email with instructions for how to confirm your email address in a few minutes'}
  }
)
get(
  '/',
  middleware.authenticate('user'),
  (req) => db.users.show(req.user.id)
)
put(
  '/',
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
        // Save new email as unconfirmed
        // When email clicked: set unconfirmed_email to email
        await db.none(
          'UPDATE users SET unconfirmed_email = ${email} WHERE id = ${id}',
          {id: req.user.id, email: req.body.email}
        )
        // Check that email is not already taken
        const other = await db.oneOrNone('SELECT email, name FROM users WHERE email = ${email}', {email: req.body.email})
        if (other) {
          await _.send_email_confirmation_exists(other)
        } else {
          // Send confirmation email
          const token = tokenizer.sign_email_confirmation(user, req.body.email)
          await _.send_email_confirmation({email: req.body.email}, token)
        }
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
post(
  '/token',
  uploads.none(),
  async (req, res) => {
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
      {user_id: user.id, jti, exp}
    )
    return void res.status(200).set({'cache-control': 'no-store'}).json(tokens)
  }
)
post(
  '/token/refresh',
  uploads.none(),
  async (req, res) => {
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
      'UPDATE refresh_tokens SET jti = ${new}, updated_at = NOW() WHERE user_id = ${user_id} AND jti = ${old} RETURNING jti',
      {user_id: user.id, old: data.jti, new: jti}
    )
    if (!refreshed) {
      return void res.status(401).json({error: 'Invalid refresh token'})
    }
    return void res.status(200).set({'cache-control': 'no-store'}).json(tokens)
  }
)
drop(
  '/',
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
get(
  '/confirmation',
  async (req, res) => {
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
  }
)
post(
  '/confirmation',
  async (req, res) => {
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
  }
)
post(
  '/confirmation/retry',
  middleware.recaptcha,
  async (req) => {
    const email = req.body.email.toLowerCase()
    const user = await db.oneOrNone(
      'SELECT id, email, unconfirmed_email, confirmed_at FROM users WHERE email = ${email} OR unconfirmed_email = ${email}',
      {email: email}
    )
    if (!user) {
      await _.send_email_confirmation_not_found({email: req.body.email})
    } else if (user.email === email && user.confirmed_at) {
      await _.send_email_confirmation_confirmed(user)
    } else {
      const token = tokenizer.sign_email_confirmation(
        user, user.unconfirmed_email ? user.unconfirmed_email : null
      )
      await _.send_email_confirmation({email: email}, token)
    }
    // Phrase: devise.confirmation.send_instructions
    return {message: 'You will receive an email with instructions for how to confirm your email address in a few minutes'}
  }
)

// Routes: User password
put(
  '/password',
  async (req, res) => {
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
  }
)
post(
  '/password/reset',
  middleware.recaptcha,
  async (req) => {
    const email = req.body.email.toLowerCase()
    const user = await db.oneOrNone(
      'SELECT id, email, name, confirmed_at, encrypted_password FROM users WHERE email=${email}',
      {email: email}
    )
    if (user) {
      const token = tokenizer.sign_password_reset(user, user.encrypted_password)
      await _.send_password_reset(user, token)
    } else {
      await _.send_password_reset_not_found({email: req.body.email})
    }
    // Phrase: devise.passwords.send_instructions
    return {message: 'You will receive an email with instructions on how to reset your password in a few minutes'}
  }
)

module.exports = router

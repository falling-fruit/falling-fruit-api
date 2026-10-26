const passwords = require('../passwords')
const multer = require('multer')
const uploads = multer({ dest: 'uploads' })
const makeRouter = require('./makeRouter')

module.exports = function({ mailer, db, middleware, tokenizer }) {
  const { router, get, post, put, drop } = makeRouter()

// Routes: Users (private)
/**
 * @openapi
 * /user:
 *   post:
 *     summary: Register a new user.
 *     description: |
 *       When first created, the account is not confirmed and cannot be used.
 *       An email is sent with a link that must be clicked to confirm the account.
 *
 *       `email` cannot match (case-insensitive) the email of an existing user. If it does, an alternate email message is sent.
 *     tags:
 *       - Authentication
 *     security:
 *       - key: []
 *     parameters:
 *       - $ref: '#/components/parameters/recaptcha'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             allOf:
 *               - $ref: '#/components/schemas/EditUser'
 *               - type: object
 *                 required:
 *                   - password
 *                 properties:
 *                   password:
 *                     $ref: '#/components/schemas/password'
 *     responses:
 *       '200':
 *         description: Success
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   minLength: 1
 *                   example: You will receive an email with instructions for how to confirm your email address in a few minutes
 */
post(
  '/user',
  middleware.recaptcha,
  async (req) => {
    // Email uniqueness is case-insensitive
    req.body.email = req.body.email.toLowerCase()
    const exists = await db.oneOrNone(
      'SELECT email, name FROM users WHERE email=${email}', {email: req.body.email}
    )
    if (exists) {
      await mailer.send_email_confirmation_exists(exists)
    } else {
      const user = await db.users.add(req)
      // Send confirmation email
      const token = tokenizer.sign_email_confirmation(user)
      await mailer.send_email_confirmation(user, token)
    }
    // Phrase: devise.confirmations.send_instructions
    return {message: 'You will receive an email with instructions for how to confirm your email address in a few minutes'}
  }
)
/**
 * @openapi
 * /user:
 *   get:
 *     summary: View the user (self).
 *     tags:
 *       - Authentication
 *     security:
 *       - key: []
 *         token: []
 *     responses:
 *       '200':
 *         description: Success
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 */
get(
  '/user',
  middleware.authenticate('user'),
  (req) => db.users.show(req.user.id)
)
/**
 * @openapi
 * /user:
 *   put:
 *     summary: Edit the user (self).
 *     description: |
 *       - If a new email is provided, it is staged as unconfirmed (`unconfirmed_email`) and a confirmation email is sent to the new email. The previous email is replaced only once the new email is confirmed. If an account with the new email already exists, a different email is sent.
 *       - If a password is provided, it takes immediate effect. If it does not match the previous password, all refresh tokens not corresponding to the current access token are revoked.
 *       - To change email or password, the existing password is required (`password_confirmation`).
 *     tags:
 *       - Authentication
 *     security:
 *       - key: []
 *         token: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             allOf:
 *               - $ref: '#/components/schemas/EditUser'
 *             type: object
 *             properties:
 *               password:
 *                 $ref: '#/components/schemas/password'
 *               password_confirmation:
 *                 description: Current password. Required for email and password change.
 *                 type: string
 *                 format: password
 *                 minLength: 1
 *                 example: foo?bar
 *     responses:
 *       '200':
 *         description: Success
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 */
put(
  '/user',
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
      const confirmed = await passwords.compare_password(
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
          await mailer.send_email_confirmation_exists(other)
        } else {
          // Send confirmation email
          const token = tokenizer.sign_email_confirmation(user, req.body.email)
          await mailer.send_email_confirmation({email: req.body.email}, token)
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
/**
 * @openapi
 * /user/token:
 *   post:
 *     summary: Request an access token (password).
 *     description: Follows the OAuth2 spec for password flow, which requires form data with `username` and `password`.
 *     tags:
 *       - Authentication
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - password
 *             properties:
 *               username:
 *                 $ref: '#/components/schemas/email'
 *               password:
 *                 $ref: '#/components/schemas/password'
 *     responses:
 *       '200':
 *         description: Success
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Token'
 */
post(
  '/user/token',
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
    if (!await passwords.compare_password(req.body.password, user.encrypted_password)) {
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
/**
 * @openapi
 * /user/token/refresh:
 *   post:
 *     summary: Request an access token (refresh token).
 *     description: |
 *       Follows the OAuth2 spec for refresh token flow, which requires form data with `grant_type: 'refresh_token'` (ignored) and `refresh_token`.
 *     tags:
 *       - Authentication
 *     security:
 *       - key: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - refresh_token
 *             properties:
 *               refresh_token:
 *                 description: Refresh token.
 *                 type: string
 *                 minLength: 1
 *                 example: 3c57bce037934965569aabfcccc861a6230768f03078ad455d1f65afb0cfbaee
 *               grant_type:
 *                 description: Grant type.
 *                 type: string
 *                 enum: [refresh_token]
 *                 example: refresh_token
 *     responses:
 *       '200':
 *         description: Success
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Token'
 */
post(
  '/user/token/refresh',
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
/**
 * @openapi
 * /user:
 *   delete:
 *     summary: Delete the user (self).
 *     tags:
 *       - Authentication
 *     security:
 *       - key: []
 *         token: []
 *     responses:
 *       '204':
 *         description: Success (no content)
 */
drop(
  '/user',
  middleware.authenticate('user'),
  async (req, res) => {
    // // Check password
    // const user = await db.one(
    //   'SELECT encrypted_password FROM users WHERE id = ${id}',
    //   {id: req.user.id}
    // )
    // if (!await passwords.compare_password(req.body.password, user.encrypted_password)) {
    //   return void res.status(401).json({error: 'Wrong password'})
    // }
    await db.users.delete(req.user.id)
    return void res.status(204).send()
  }
)

// Routes: User email
/**
 * @openapi
 * /user/confirmation:
 *   get:
 *     summary: Confirm the user (from a link in an email).
 *     tags:
 *       - Authentication
 *     parameters:
 *       - name: token
 *         description: Email-confirmation token.
 *         in: query
 *         schema:
 *           type: string
 *           minLength: 1
 *         required: true
 *         example: 3c57bce037934965569aabfcccc861a6230768f03078ad455d1f65afb0cfbaee
 *     responses:
 *       '200':
 *         description: Success
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   minLength: 1
 *                   example: Your email address has been successfully confirmed
 */
get(
  '/user/confirmation',
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
/**
 * @openapi
 * /user/confirmation:
 *   post:
 *     summary: Confirm the user (from a form).
 *     tags:
 *       - Authentication
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - token
 *             properties:
 *               token:
 *                 description: Email-confirmation token.
 *                 type: string
 *                 minLength: 1
 *                 example: 3c57bce037934965569aabfcccc861a6230768f03078ad455d1f65afb0cfbaee
 *     responses:
 *       '200':
 *         description: Success
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required:
 *                 - email
 *               properties:
 *                 email:
 *                   $ref: '#/components/schemas/email'
 */
post(
  '/user/confirmation',
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
/**
 * @openapi
 * /user/confirmation/retry:
 *   post:
 *     summary: Request another email-confirmation email.
 *     description: Alternate email messages are sent if the email is not found or if the email is already confirmed.
 *     tags:
 *       - Authentication
 *     security:
 *       - key: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 $ref: '#/components/schemas/email'
 *     responses:
 *       '200':
 *         description: Success
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   minLength: 1
 *                   example: You will receive an email with instructions for how to confirm your email address in a few minutes
 */
post(
  '/user/confirmation/retry',
  middleware.recaptcha,
  async (req) => {
    const email = req.body.email.toLowerCase()
    const user = await db.oneOrNone(
      'SELECT id, email, unconfirmed_email, confirmed_at FROM users WHERE email = ${email} OR unconfirmed_email = ${email}',
      {email: email}
    )
    if (!user) {
      await mailer.send_email_confirmation_not_found({email: req.body.email})
    } else if (user.email === email && user.confirmed_at) {
      await mailer.send_email_confirmation_confirmed(user)
    } else {
      const token = tokenizer.sign_email_confirmation(
        user, user.unconfirmed_email ? user.unconfirmed_email : null
      )
      await mailer.send_email_confirmation({email: email}, token)
    }
    // Phrase: devise.confirmation.send_instructions
    return {message: 'You will receive an email with instructions for how to confirm your email address in a few minutes'}
  }
)

// Routes: User password
/**
 * @openapi
 * /user/password:
 *   put:
 *     summary: Set a new password.
 *     tags:
 *       - Authentication
 *     security:
 *       - key: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - token
 *               - password
 *             properties:
 *               token:
 *                 description: Password-reset token.
 *                 type: string
 *                 minLength: 1
 *                 example: 3c57bce037934965569aabfcccc861a6230768f03078ad455d1f65afb0cfbaee
 *               password:
 *                 $ref: '#/components/schemas/password'
 *     responses:
 *       '200':
 *         description: Success
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 email:
 *                   $ref: '#/components/schemas/email'
 */
put(
  '/user/password',
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
/**
 * @openapi
 * /user/password/reset:
 *   post:
 *     summary: Request a password-reset email.
 *     description: An alternate email message is sent if the email is not found.
 *     tags:
 *       - Authentication
 *     security:
 *       - key: []
 *     parameters:
 *       - $ref: '#/components/parameters/recaptcha'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 $ref: '#/components/schemas/email'
 *     responses:
 *       '200':
 *         description: Success
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   minLength: 1
 *                   example: You will receive an email with instructions on how to reset your password in a few minutes
 */
post(
  '/user/password/reset',
  middleware.recaptcha,
  async (req) => {
    const email = req.body.email.toLowerCase()
    const user = await db.oneOrNone(
      'SELECT id, email, name, confirmed_at, encrypted_password FROM users WHERE email=${email}',
      {email: email}
    )
    if (user) {
      const token = tokenizer.sign_password_reset(user, user.encrypted_password)
      await mailer.send_password_reset(user, token)
    } else {
      await mailer.send_password_reset_not_found({email: req.body.email})
    }
    // Phrase: devise.passwords.send_instructions
    return {message: 'You will receive an email with instructions on how to reset your password in a few minutes'}
  }
)

  return router
}

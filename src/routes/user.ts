import multer from 'multer'
import makeRouter from './makeRouter'
import type { Services } from './services'
import { z, inlineAllOf } from '../schemas/registry'
import { User, EditUser, Token } from '../schemas/schemas'
import { emailProp, passwordProp } from '../schemas/properties'
import { recaptchaParam } from '../schemas/parameters'

import passwords from '../passwords'
const uploads = multer({ dest: 'uploads' })

type ConfirmationUserRow = {
  id: number
  email: string
  confirmed_at: string | null
  unconfirmed_email: string | null
}

type PasswordResetUserRow = {
  id: number
  email: string
  encrypted_password: string
}

const messageResponse = (example: string) =>
  z.object({
    message: z.string().min(1).openapi({ example }),
  })

// Request bodies accept a subset of EditUser: only email is required;
// name, bio, range, and announcements_email default server-side. These are
// used for runtime validation only; the OpenAPI body stays the documented
// allOf(EditUser, password) composition.
const SignupBody = z.object({
  email: emailProp,
  password: passwordProp,
  name: z.string().min(1).nullable().optional(),
  bio: z.string().min(1).nullable().optional(),
  announcements_email: z.boolean().optional(),
})

const EditUserBody = z.object({
  email: emailProp,
  name: z.string().min(1).nullable().optional(),
  bio: z.string().min(1).nullable().optional(),
  announcements_email: z.boolean().optional(),
  password: passwordProp.optional(),
  password_confirmation: z.string().min(1).optional(),
})

export default function ({ mailer, db, middleware, auth, tokenizer }: Services) {
  const { router, get, post, put, drop } = makeRouter()

  // Routes: Users (private)
  post(
    {
      path: '/user',
      summary: 'Register a new user.',
      description:
        '\nWhen first created, the account is not confirmed and cannot be used.\nAn email is sent with a link that must be clicked to confirm the account.\n\n`email` cannot match (case-insensitive) the email of an existing user. If it does, an alternate email message is sent.\n',
      tags: ['Authentication'],
      security: [{ key: [] }],
      request: {
        headers: [recaptchaParam],
        body: {
          required: true,
          schema: inlineAllOf([
            EditUser,
            z.object({ password: passwordProp }),
          ]),
        },
        validateBody: SignupBody,
      },
      responses: {
        '200': {
          description: 'Success',
          schema: messageResponse(
            'You will receive an email with instructions for how to confirm your email address in a few minutes',
          ),
        },
      },
    },
    auth.none,
    middleware.recaptcha,
    async (req) => {
      // Email uniqueness is case-insensitive
      req.body.email = req.body.email.toLowerCase()
      const exists = await db.oneOrNone<{ email: string; name: string | null }>(
        'SELECT email, name FROM users WHERE email=${email}',
        { email: req.body.email },
      )
      if (exists) {
        await mailer.send_email_confirmation_exists(exists)
      } else {
        const user = await db.users.add(req)
        const token = tokenizer.sign_email_confirmation(user)
        await mailer.send_email_confirmation(user, token)
      }
      // Phrase: devise.confirmations.send_instructions
      return {
        message:
          'You will receive an email with instructions for how to confirm your email address in a few minutes',
      }
    },
  )

  get(
    {
      path: '/user',
      summary: 'View the user (self).',
      tags: ['Authentication'],
      security: [{ key: [], token: [] }],
      responses: {
        '200': { description: 'Success', schema: User },
      },
    },
    auth.required_role('user'),
    (req, user) => db.users.show(user.id),
  )

  put(
    {
      path: '/user',
      summary: 'Edit the user (self).',
      description:
        '\n- If a new email is provided, it is staged as unconfirmed (`unconfirmed_email`) and a confirmation email is sent to the new email. The previous email is replaced only once the new email is confirmed. If an account with the new email already exists, a different email is sent.\n- If a password is provided, it takes immediate effect. If it does not match the previous password, all refresh tokens not corresponding to the current access token are revoked.\n- To change email or password, the existing password is required (`password_confirmation`).\n',
      tags: ['Authentication'],
      security: [{ key: [], token: [] }],
      request: {
        body: {
          required: true,
          schema: inlineAllOf([
            EditUser,
            z.object({
              password: passwordProp.optional(),
              password_confirmation: z.string().min(1).openapi({
                description:
                  'Current password. Required for email and password change.',
                format: 'password',
                example: 'foo?bar',
              }),
            }),
          ]),
        },
        validateBody: EditUserBody,
      },
      responses: {
        '200': { description: 'Success', schema: User },
      },
    },
    auth.required_role('user'),
    async (req, authUser, res) => {
      const user = await db.one<{
        id: number
        name: string | null
        encrypted_password: string
        email: string
      }>(
        'SELECT id, name, encrypted_password, email FROM users WHERE id = ${id}',
        { id: authUser.id },
      )
      if (req.body.email != user.email || req.body.password) {
        if (!req.body.password_confirmation) {
          return void res.status(401).json({
            error:
              'Current password is required to change email or password',
          })
        }
        const confirmed = await passwords.compare_password(
          req.body.password_confirmation,
          user.encrypted_password,
        )
        if (!confirmed) {
          return void res.status(401).json({ error: 'Wrong password' })
        }
        if (req.body.email != user.email) {
          await db.none(
            'UPDATE users SET unconfirmed_email = ${email} WHERE id = ${id}',
            { id: authUser.id, email: req.body.email },
          )
          const other = await db.oneOrNone<{ email: string; name: string | null }>(
            'SELECT email, name FROM users WHERE email = ${email}',
            { email: req.body.email },
          )
          if (other) {
            await mailer.send_email_confirmation_exists(other)
          } else {
            const token = tokenizer.sign_email_confirmation(
              user,
              req.body.email,
            )
            await mailer.send_email_confirmation(
              { email: req.body.email },
              token,
            )
          }
        }
        if (req.body.password === req.body.password_confirmation) {
          delete req.body.password
        } else {
          await db.none(
            'DELETE FROM refresh_tokens WHERE user_id = ${id} AND jti != ${jti}',
            { id: authUser.id, jti: authUser.jti },
          )
        }
      }
      return db.users.edit(req, authUser)
    },
  )

  post(
    {
      path: '/user/token',
      summary: 'Request an access token (password).',
      description:
        'Follows the OAuth2 spec for password flow, which requires form data with `username` and `password`.',
      tags: ['Authentication'],
      request: {
        body: {
          required: true,
          mediaType: 'multipart/form-data',
          schema: z.object({
            username: emailProp,
            password: passwordProp,
          }),
        },
      },
      responses: {
        '200': { description: 'Success', schema: Token },
      },
    },
    auth.none,
    uploads.none(),
    async (req, res) => {
      let user
      try {
        user = await db.one<{
          id: number
          roles: string[]
          encrypted_password: string
          confirmed_at: string | null
        }>(
          'SELECT id, roles, encrypted_password, confirmed_at FROM users WHERE email = ${email}',
          { email: req.body.username.toLowerCase() },
        )
      } catch {
        // Phrase: devise.failure.invalid
        return void res
          .status(401)
          .json({ error: 'Invalid email or password' })
      }
      if (!user.confirmed_at) {
        // Phrase: devise.failure.unconfirmed
        throw Error(
          'You have to confirm your email address before continuing',
        )
      }
      if (
        !(await passwords.compare_password(
          req.body.password,
          user.encrypted_password,
        ))
      ) {
        // Phrase: devise.failure.invalid
        return void res
          .status(401)
          .json({ error: 'Invalid email or password' })
      }
      const [tokens, jti, exp] = tokenizer.sign_and_wrap_access(user)
      await db.none(
        'INSERT INTO refresh_tokens (user_id, jti, exp) VALUES (${user_id}, ${jti}, ${exp})',
        { user_id: user.id, jti, exp },
      )
      return void res
        .status(200)
        .set({ 'cache-control': 'no-store' })
        .json(tokens)
    },
  )

  post(
    {
      path: '/user/token/refresh',
      summary: 'Request an access token (refresh token).',
      description:
        "Follows the OAuth2 spec for refresh token flow, which requires form data with `grant_type: 'refresh_token'` (ignored) and `refresh_token`.\n",
      tags: ['Authentication'],
      security: [{ key: [] }],
      request: {
        body: {
          required: true,
          mediaType: 'multipart/form-data',
          schema: z.object({
            refresh_token: z.string().min(1).openapi({
              description: 'Refresh token.',
              example:
                '3c57bce037934965569aabfcccc861a6230768f03078ad455d1f65afb0cfbaee',
            }),
            grant_type: z.enum(['refresh_token']).optional().openapi({
              description: 'Grant type.',
              example: 'refresh_token',
            }),
          }),
        },
      },
      responses: {
        '200': { description: 'Success', schema: Token },
      },
    },
    auth.none,
    uploads.none(),
    async (req, res) => {
      const token = req.body.refresh_token
      const data = tokenizer.verify_refresh(token, res)
      if (!data) {
        return
      }
      const user = await db.oneOrNone<{ id: number; roles: string[] }>(
        'SELECT id, roles FROM users WHERE id = ${id}',
        { id: data.id },
      )
      if (!user) {
        return void res.status(401).json({ error: 'Invalid refresh token' })
      }
      const [tokens, jti] = tokenizer.sign_and_wrap_access(
        user,
        data.exp,
      )
      const refreshed = await db.oneOrNone<{ jti: string }>(
        'UPDATE refresh_tokens SET jti = ${new}, updated_at = NOW() WHERE user_id = ${user_id} AND jti = ${old} RETURNING jti',
        { user_id: user.id, old: data.jti, new: jti },
      )
      if (!refreshed) {
        return void res.status(401).json({ error: 'Invalid refresh token' })
      }
      return void res
        .status(200)
        .set({ 'cache-control': 'no-store' })
        .json(tokens)
    },
  )

  drop(
    {
      path: '/user',
      summary: 'Delete the user (self).',
      tags: ['Authentication'],
      security: [{ key: [], token: [] }],
      responses: {
        '204': { description: 'Success (no content)' },
      },
    },
    auth.required_role('user'),
    async (req, user, res) => {
      await db.users.delete(user.id)
      return void res.status(204).send()
    },
  )

  // Routes: User email
  get(
    {
      path: '/user/confirmation',
      summary: 'Confirm the user (from a link in an email).',
      tags: ['Authentication'],
      request: {
        query: z.object({
          token: z.string().min(1).openapi({
            param: { name: 'token', in: 'query', required: true },
            description: 'Email-confirmation token.',
            example:
              '3c57bce037934965569aabfcccc861a6230768f03078ad455d1f65afb0cfbaee',
          }),
        }),
      },
      responses: {
        '200': {
          description: 'Success',
          schema: messageResponse(
            'Your email address has been successfully confirmed',
          ),
        },
      },
    },
    auth.none,
    async (req, res) => {
      const token = req.query.token
      const data = tokenizer.verify_email_confirmation(token, res)
      if (!data) {
        return
      }
      const user = await db.oneOrNone<ConfirmationUserRow>(
        'SELECT id, email, confirmed_at, unconfirmed_email FROM users WHERE id=${id}',
        { id: data.id },
      )
      if (!user) {
        // Phrase: devise.errors.messages.not_found
        throw Error('Email not found')
      }
      if (user.unconfirmed_email) {
        if (user.unconfirmed_email === data.email) {
          await db.none(
            'UPDATE users SET email = unconfirmed_email, unconfirmed_email = NULL WHERE id = ${id}',
            { id: user.id },
          )
          return {
            message: 'Your email address has been successfully confirmed',
          }
        } else {
          throw Error(
            'Email-confirmation token is not for the newest email on your account',
          )
        }
      }
      if (user.confirmed_at) {
        // Phrase: devise.errors.messages.already_confirmed
        throw Error('Email was already confirmed, please try signing in')
      }
      await db.users.confirm(user.id)
      // Phrase: devise.confirmation.confirmed
      return { message: 'Your email address has been successfully confirmed' }
    },
  )

  post(
    {
      path: '/user/confirmation',
      summary: 'Confirm the user (from a form).',
      tags: ['Authentication'],
      request: {
        body: {
          required: true,
          schema: z.object({
            token: z.string().min(1).openapi({
              description: 'Email-confirmation token.',
              example:
                '3c57bce037934965569aabfcccc861a6230768f03078ad455d1f65afb0cfbaee',
            }),
          }),
        },
      },
      responses: {
        '200': {
          description: 'Success',
          schema: z.object({ email: emailProp }),
        },
      },
    },
    auth.none,
    async (req, res) => {
      const token = req.body.token
      const data = tokenizer.verify_email_confirmation(token, res)
      if (!data) {
        return
      }
      const user = await db.oneOrNone<ConfirmationUserRow>(
        'SELECT id, email, confirmed_at, unconfirmed_email FROM users WHERE id=${id}',
        { id: data.id },
      )
      if (!user) {
        throw Error('Email not found')
      }
      if (user.unconfirmed_email) {
        if (user.unconfirmed_email === data.email) {
          await db.none(
            'UPDATE users SET email = unconfirmed_email, unconfirmed_email = NULL WHERE id = ${id}',
            { id: user.id },
          )
          return { email: user.unconfirmed_email }
        } else {
          throw Error(
            'Email-confirmation token does not match the newest email on your account',
          )
        }
      }
      if (user.confirmed_at) {
        throw Error('Email was already confirmed, please try signing in')
      }
      await db.users.confirm(user.id)
      return { email: user.email }
    },
  )

  post(
    {
      path: '/user/confirmation/retry',
      summary: 'Request another email-confirmation email.',
      description:
        'Alternate email messages are sent if the email is not found or if the email is already confirmed.',
      tags: ['Authentication'],
      security: [{ key: [] }],
      request: {
        body: {
          required: true,
          schema: z.object({ email: emailProp }),
        },
      },
      responses: {
        '200': {
          description: 'Success',
          schema: messageResponse(
            'You will receive an email with instructions for how to confirm your email address in a few minutes',
          ),
        },
      },
    },
    auth.none,
    middleware.recaptcha,
    async (req) => {
      const email = req.body.email.toLowerCase()
      const user = await db.oneOrNone<ConfirmationUserRow>(
        'SELECT id, email, unconfirmed_email, confirmed_at FROM users WHERE email = ${email} OR unconfirmed_email = ${email}',
        { email },
      )
      if (!user) {
        await mailer.send_email_confirmation_not_found({
          email: req.body.email,
        })
      } else if (user.email === email && user.confirmed_at) {
        await mailer.send_email_confirmation_confirmed(user)
      } else {
        const token = tokenizer.sign_email_confirmation(
          user,
          user.unconfirmed_email ? user.unconfirmed_email : null,
        )
        await mailer.send_email_confirmation({ email }, token)
      }
      // Phrase: devise.confirmation.send_instructions
      return {
        message:
          'You will receive an email with instructions for how to confirm your email address in a few minutes',
      }
    },
  )

  // Routes: User password
  put(
    {
      path: '/user/password',
      summary: 'Set a new password.',
      tags: ['Authentication'],
      security: [{ key: [] }],
      request: {
        body: {
          required: true,
          schema: z.object({
            token: z.string().min(1).openapi({
              description: 'Password-reset token.',
              example:
                '3c57bce037934965569aabfcccc861a6230768f03078ad455d1f65afb0cfbaee',
            }),
            password: passwordProp,
          }),
        },
      },
      responses: {
        '200': {
          description: 'Success',
          schema: z.object({ email: emailProp }),
        },
      },
    },
    auth.none,
    async (req, res) => {
      const token = req.body.token
      let data = tokenizer.decode_password_reset(token, res)
      if (!data) {
        return
      }
      const user = await db.oneOrNone<PasswordResetUserRow>(
        'SELECT id, email, encrypted_password FROM users WHERE id=${id}',
        { id: data.id },
      )
      if (!user) {
        throw Error('Account not found')
      }
      data = tokenizer.verify_password_reset(
        token,
        user.encrypted_password,
        res,
      )
      if (!data) {
        return
      }
      await db.users.set_password(user.id, req.body.password)
      // Phrase: devise.passwords.updated_not_active
      return { email: user.email }
    },
  )

  post(
    {
      path: '/user/password/reset',
      summary: 'Request a password-reset email.',
      description: 'An alternate email message is sent if the email is not found.',
      tags: ['Authentication'],
      security: [{ key: [] }],
      request: {
        headers: [recaptchaParam],
        body: {
          required: true,
          schema: z.object({ email: emailProp }),
        },
      },
      responses: {
        '200': {
          description: 'Success',
          schema: messageResponse(
            'You will receive an email with instructions on how to reset your password in a few minutes',
          ),
        },
      },
    },
    auth.none,
    middleware.recaptcha,
    async (req) => {
      const email = req.body.email.toLowerCase()
      const user = await db.oneOrNone<{
        id: number
        email: string
        name: string | null
        confirmed_at: string | null
        encrypted_password: string
      }>(
        'SELECT id, email, name, confirmed_at, encrypted_password FROM users WHERE email=${email}',
        { email },
      )
      if (user) {
        const token = tokenizer.sign_password_reset(
          user,
          user.encrypted_password,
        )
        await mailer.send_password_reset(user, token)
      } else {
        await mailer.send_password_reset_not_found({ email: req.body.email })
      }
      // Phrase: devise.passwords.send_instructions
      return {
        message:
          'You will receive an email with instructions on how to reset your password in a few minutes',
      }
    },
  )

  return router
}

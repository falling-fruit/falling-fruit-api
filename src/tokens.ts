import crypto from 'crypto'
import jwt from 'jsonwebtoken'
import type { Response } from 'express'

type Algorithm = jwt.Algorithm

/** User fields needed to issue tokens. */
type TokenUser = {
  id: number
  roles?: string[]
}

/** Access/refresh token bundle returned to clients. */
type TokenBundle = {
  access_token: string
  token_type: 'bearer'
  expires_in: number
  refresh_token: string
}

/** Decoded access token payload. */
type AccessTokenData = {
  id: number
  roles: string[]
  exp: number
  jti: string
}

/** Decoded refresh token payload. */
type RefreshTokenData = {
  id: number
  exp: number
  jti: string
}

/** Decoded email-confirmation token payload. */
type EmailConfirmationData = {
  id: number
  email?: string
}

/** Decoded password-reset token payload. */
type PasswordResetData = {
  id: number
}

/**
 * Shape of the JWT payloads this service issues. `jwt.JwtPayload` types its
 * custom claims as `any` via an index signature; narrowing to this type keeps
 * field reads type-safe.
 */
type DecodedPayload = jwt.JwtPayload & {
  id: number
  roles?: string[]
  email?: string
  exp?: number
  jti?: string
}

class Tokenizer {
  secret: string
  algorithm: Algorithm

  constructor(secret: string, algorithm: Algorithm = 'HS256') {
    this.secret = secret
    this.algorithm = algorithm
  }

  sign(
    data: string | object | Buffer,
    options: jwt.SignOptions = {},
    secret: jwt.Secret = this.secret,
  ): string {
    return jwt.sign(data, secret, { algorithm: this.algorithm, ...options })
  }

  verify(
    token: string,
    options: jwt.VerifyOptions = {},
    secret: jwt.Secret = this.secret,
  ): DecodedPayload {
    return jwt.verify(token, secret, {
      algorithms: [this.algorithm],
      ...options,
    }) as DecodedPayload
  }

  sign_and_wrap_access(
    user: TokenUser,
    exp: number | null = null,
  ): [TokenBundle, string, number] {
    const ACCESS_EXPIRES_IN = 900 // 15 min
    const REFRESH_EXPIRES_IN = 2592000 // 30 days
    const jti = crypto.randomBytes(6).toString('hex')
    exp = exp || Math.floor(Date.now() / 1000) + REFRESH_EXPIRES_IN
    const tokens: TokenBundle = {
      access_token: this.sign(
        { id: user.id, roles: user.roles, jti },
        { expiresIn: ACCESS_EXPIRES_IN },
      ),
      token_type: 'bearer',
      expires_in: ACCESS_EXPIRES_IN,
      refresh_token: this.sign({ id: user.id, exp, jti }),
    }
    return [tokens, jti, exp]
  }

  verify_access(token: string, res: Response): AccessTokenData | undefined {
    try {
      const data = this.verify(token)
      if (data.exp == null || data.jti == null) {
        throw new jwt.JsonWebTokenError('Missing exp or jti claim')
      }
      return { id: data.id, roles: data.roles ?? [], exp: data.exp, jti: data.jti }
    } catch (err) {
      if (err instanceof jwt.TokenExpiredError) {
        // Phrase: no equivalent (see devise.failure.timeout for sessions)
        return void res.status(401).json({ error: 'Expired access token' })
      }
      // Phrase: devise.failure.invalid_token
      return void res.status(401).json({ error: 'Invalid access token' })
    }
  }

  verify_refresh(token: string, res: Response): RefreshTokenData | undefined {
    try {
      const data = this.verify(token)
      if (data.exp == null || data.jti == null) {
        throw new jwt.JsonWebTokenError('Missing exp or jti claim')
      }
      return { id: data.id, exp: data.exp, jti: data.jti }
    } catch (err) {
      if (err instanceof jwt.TokenExpiredError) {
        // Phrase: no equivalent (see devise.failure.timeout for sessions)
        return void res.status(401).json({ error: 'Expired refresh token' })
      }
      // Phrase: devise.failure.invalid_token
      return void res.status(401).json({ error: 'Invalid refresh token' })
    }
  }

  sign_email_confirmation(user: TokenUser, email: string | null = null): string {
    const data: { id: number; email?: string } = { id: user.id }
    if (email) {
      Object.assign(data, { email: email })
    }
    return this.sign(data, { expiresIn: '1d', noTimestamp: true })
  }

  verify_email_confirmation(
    token: string,
    res: Response,
  ): EmailConfirmationData | undefined {
    try {
      const data = this.verify(token)
      return { id: data.id, email: data.email }
    } catch (err) {
      if (err instanceof jwt.TokenExpiredError) {
        // Phrase: devise.errors.messages.expired
        return void res.status(401).json({
          error: 'Expired email-confirmation token. Please request a new one',
        })
      }
      // Phrase: devise.failure.invalid_token
      return void res
        .status(401)
        .json({ error: 'Invalid email-confirmation token' })
    }
  }

  sign_password_reset(user: TokenUser, password_hash: string): string {
    const secret = `${password_hash}${this.secret}`
    return this.sign(
      { id: user.id },
      { expiresIn: '12h', noTimestamp: true },
      secret,
    )
  }

  decode_password_reset(
    token: string,
    res: Response,
  ): PasswordResetData | undefined {
    try {
      const data = jwt.decode(token) as DecodedPayload
      return { id: data.id }
    } catch {
      // Phrase: devise.failure.invalid_token
      return void res
        .status(401)
        .json({ error: 'Invalid password-reset token' })
    }
  }

  verify_password_reset(
    token: string,
    password_hash: string,
    res: Response,
  ): PasswordResetData | undefined {
    const secret = `${password_hash}${this.secret}`
    try {
      const data = this.verify(token, {}, secret)
      return { id: data.id }
    } catch (err) {
      if (err instanceof jwt.TokenExpiredError) {
        // Phrase: devise.errors.messages.expired
        return void res
          .status(401)
          .json({ error: 'Expired password-reset token' })
      }
      // Token either invalid or password has changed since it was issued
      // Phrase: devise.failure.invalid_token
      return void res
        .status(401)
        .json({ error: 'Invalid (or expired) password-reset token' })
    }
  }
}

export default Tokenizer

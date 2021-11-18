require('dotenv').config()
const jwt = require('jsonwebtoken')

class Tokenizer {
  constructor(algorithm = 'HS256') {
    this.algorithm = algorithm
  }

  sign(data, options = {}, secret = process.env.JWT_SECRET) {
    return jwt.sign(
      data, secret, {algorithm: this.algorithm, ...options}
    )
  }

  verify(token, options = {}, secret = process.env.JWT_SECRET) {
    return jwt.verify(
      token, secret, {algorithm: this.algorithm, ...options}
    )
  }

  sign_and_wrap_access(user) {
    // 15 min
    const EXPIRES_IN = 900
    return {
      access_token: this.sign(
        {id: user.id, roles: user.roles}, {expiresIn: EXPIRES_IN}
      ),
      token_type: 'bearer',
      expires_in: EXPIRES_IN
    }
  }

  verify_access(token, res) {
    try {
      const data = this.verify(token)
      return {id: data.id, roles: data.roles}
    } catch (err) {
      if (err instanceof jwt.TokenExpiredError) {
        // Phrase: no equivalent (see devise.failure.timeout for sessions)
        return void res.status(401).json({error: 'Expired access token'})
      }
      // Phrase: devise.failure.invalid_token
      return void res.status(401).json({error: 'Invalid access token'})
    }
  }

  sign_email_confirmation(user) {
    return this.sign({id: user.id}, {expiresIn: '1d', noTimestamp: true})
  }

  verify_email_confirmation(token, res) {
    try {
      const data = this.verify(token)
      return {id: data.id}
    } catch (err) {
      if (err instanceof jwt.TokenExpiredError) {
        // Phrase: devise.errors.messages.expired
        return void res.status(401).json({error: 'Expired email-confirmation token. Please request a new one'})
      }
      // Phrase: devise.failure.invalid_token
      return void res.status(401).json({error: 'Invalid email-confirmation token'})
    }
  }

  sign_password_reset(user, password_hash) {
    const secret = `${password_hash}${process.env.JWT_SECRET}`
    return this.sign(
      {id: user.id}, {expiresIn: '12h', noTimestamp: true}, secret
    )
  }

  decode_password_reset(token, res) {
    try {
      const data = jwt.decode(token, {algorithm: this.algorithm})
      return {id: data.id}
    } catch (err) {
      // Phrase: devise.failure.invalid_token
      return void res.status(401).json({error: 'Invalid password-reset token'})
    }
  }

  verify_password_reset(token, password_hash, res) {
    const secret = `${password_hash}${process.env.JWT_SECRET}`
    try {
      const data = this.verify(token, {}, secret)
      return {id: data.id}
    } catch (err) {
      if (err instanceof jwt.TokenExpiredError) {
        // Phrase: devise.errors.messages.expired
        return void res.status(401).json({error: 'Expired password-reset token'})
      }
      // Token either invalid or password has changed since it was issued
      // Phrase: devise.failure.invalid_token
      return void res.status(401).json({error: 'Invalid (or expired) password-reset token'})
    }
  }
}

module.exports = Tokenizer

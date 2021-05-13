const sql = require('../sql').users
const bcrypt = require('bcrypt')
const crypto = require('crypto')
const base64url = require('base64url')

const SALT_ROUNDS = 10
const TOKEN_BYTES = 24

class Users {
  constructor(db, pgp) {
    this.db = db
    this.pgp = pgp
  }

  async add(req) {
    const values = {
      name: null,
      add_anonymously: false,
      ...req.body
    }
    // Store encrypted password
    values.password = await bcrypt.hash(values.password, SALT_ROUNDS)
    // Store URL-friendly authentication token for next session
    values.token = base64url(crypto.randomBytes(TOKEN_BYTES))
    return this.db.one(sql.add, values)
  }

  async get_token({email, password}) {
    let data
    try {
      data = await this.db.one(
        'SELECT encrypted_password, authentication_token FROM users WHERE email = ${email}',
        {email: email}
      )
    } catch (error) {
      throw Error('Invalid email or password')
    }
    if (!await bcrypt.compare(password, data.encrypted_password)) {
      throw Error('Invalid email or password')
    }
    return data.authentication_token
  }

  async find_user_by_token({token}) {
    let data
    try {
      data = await this.db.one(
        'SELECT id FROM users WHERE authentication_token = ${token}',
        {token: token}
      )
    } catch (error) {
      throw Error('Invalid token')
    }
    return data.id
  }
}

module.exports = Users

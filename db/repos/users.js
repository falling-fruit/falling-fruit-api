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
}

module.exports = Users

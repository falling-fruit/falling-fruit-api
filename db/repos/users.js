const sql = require('../sql').users
const _ = require('../../helpers')

class Users {
  constructor(db, pgp) {
    this.db = db
    this.pgp = pgp
  }

  async add(req) {
    const values = {
      name: null,
      ...req.body
    }
    // Store encrypted password
    values.password = await _.hash_password(values.password)
    return this.db.one(sql.add, values)
  }

  show(id) {
    return this.db.one(sql.show, {id: id})
  }

  edit(req) {
    const values = {
      ...req.body,
      id: req.user.id
    }
    // TODO: Change password
    // TODO: Change and confirm email
    return this.db.one(sql.edit, values)
  }

  confirm(id) {
    return this.db.none(sql.confirm, {id: id})
  }

  async set_password(id, password) {
    const hash = await _.hash_password(password)
    return this.db.none(sql.setPassword, {id: id, password: hash})
  }
}

module.exports = Users

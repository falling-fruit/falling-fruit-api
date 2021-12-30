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
      range: null,
      ...req.body
    }
    // Store encrypted password
    values.password = await _.hash_password(values.password)
    return this.db.one(sql.add, values)
  }

  show(id) {
    return this.db.one(sql.show, {id: id})
  }

  async edit(req) {
    const values = {
      ...req.body,
      id: req.user.id
    }
    if (values.password) {
      values.password = await _.hash_password(values.password)
      return this.db.one(sql.editPassword, values)
    }
    return this.db.one(sql.edit, values)
  }

  confirm(id) {
    return this.db.none(sql.confirm, {id: id})
  }

  async set_password(id, password) {
    const hash = await _.hash_password(password)
    return this.db.none(sql.setPassword, {id: id, password: hash})
  }

  delete(id) {
    // TODO: What happens to user content (photos, reviews, locations, ...) ?
    return this.db.none('DELETE FROM users WHERE id = ${id}', {id: parseInt(id)})
  }
}

module.exports = Users

const sql = require('../sql').users
const passwords = require('../../passwords')
const User = require('../../mappers/user')

class Users {
  constructor(db, pgp) {
    this.db = db
    this.pgp = pgp
  }

  async add(req) {
    const values = User.toRow(req.body)
    // Store encrypted password
    values.password = await passwords.hash_password(values.password)
    const user = await this.db.one(sql.add, values)
    return User.fromRow(user)
  }

  async show(id) {
    const user = await this.db.one(sql.show, {id: id})
    return User.fromRow(user)
  }

  async show_public(id) {
    const user = await this.db.one(sql.showPublic, {id: parseInt(id)})
    return User.fromRow(user)
  }

  async edit(req) {
    const values = {
      ...req.body,
      id: req.user.id
    }
    if (values.password) {
      values.password = await passwords.hash_password(values.password)
      return this.db.one(sql.editPassword, values)
    }
    const user = await this.db.one(sql.edit, values)
    return User.fromRow(user)
  }

  confirm(id) {
    return this.db.none(sql.confirm, {id: id})
  }

  async set_password(id, password) {
    const hash = await passwords.hash_password(password)
    return this.db.none(sql.setPassword, {id: id, password: hash})
  }

  delete(id) {
    // TODO: What happens to user content (photos, reviews, locations, ...) ?
    return this.db.none('DELETE FROM users WHERE id = ${id}', {id: parseInt(id)})
  }

  subscribe(email) {
    return this.db.none(sql.subscribe, {email})
  }

  unsubscribe(email) {
    return this.db.none(sql.unsubscribe, {email})
  }
}

module.exports = Users

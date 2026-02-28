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
      bio: null,
      range: null,
      announcements_email: true,
      private: false,
      ...req.body
    }
    if (!values.name && !values.private) {
      throw new Error('User name is required for public profiles')
    }
    // Store encrypted password
    values.password = await _.hash_password(values.password)
    const user = await this.db.one(sql.add, values)
    return _.format_user(user)
  }

  async show(id) {
    const user = await this.db.one(sql.show, {id: id})
    return _.format_user(user)
  }

  async show_public(id) {
    const user = await this.db.one(sql.showPublic, {id: parseInt(id)})
    return _.format_user(user)
  }

  async edit(req) {
    const values = {
      ...req.body,
      id: req.user.id
    }
    if (!values.name && !values.private) {
      throw new Error('User name is required for public profiles')
    }
    if (values.password) {
      values.password = await _.hash_password(values.password)
      return this.db.one(sql.editPassword, values)
    }
    const user = await this.db.one(sql.edit, values)
    return _.format_user(user)
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

  subscribe(email) {
    return this.db.none(sql.subscribe, {email})
  }

  unsubscribe(email) {
    return this.db.none(sql.unsubscribe, {email})
  }
}

module.exports = Users

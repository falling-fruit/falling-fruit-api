import sqlModule = require('../sql')
import passwords = require('../../passwords')
import User = require('../../mappers/user')
import type { Protocol, Pgp } from '../types'
import type { EditUser, User as ApiUser } from '../../schemas/schemas'

const sql = sqlModule.users

type UserRow = Parameters<typeof User.fromRow>[0]

type AddRequest = { body: Partial<EditUser> & { password: string } & Record<string, unknown> }
type EditRequest = {
  body: Partial<EditUser> & { password?: string } & Record<string, unknown>
  user: { id: number }
}

class Users {
  db: Protocol
  pgp: Pgp

  constructor(db: Protocol, pgp: Pgp) {
    this.db = db
    this.pgp = pgp
  }

  async add(req: AddRequest): Promise<ApiUser> {
    const values = User.toRow(req.body)
    // Store encrypted password
    values.password = await passwords.hash_password(req.body.password)
    const user = await this.db.one<UserRow>(sql.add, values)
    return User.fromRow(user)
  }

  async show(id: number | string): Promise<ApiUser> {
    const user = await this.db.one<UserRow>(sql.show, { id: id })
    return User.fromRow(user)
  }

  async show_public(id: number | string): Promise<ApiUser> {
    const user = await this.db.one<UserRow>(sql.showPublic, {
      id: parseInt(String(id)),
    })
    return User.fromRow(user)
  }

  async edit(req: EditRequest): Promise<ApiUser> {
    const values: Record<string, unknown> = {
      ...req.body,
      id: req.user.id,
    }
    if (values.password) {
      values.password = await passwords.hash_password(values.password as string)
      const user = await this.db.one<UserRow>(sql.editPassword, values)
      return User.fromRow(user)
    }
    const user = await this.db.one<UserRow>(sql.edit, values)
    return User.fromRow(user)
  }

  confirm(id: number | string) {
    return this.db.none(sql.confirm, { id: id })
  }

  async set_password(id: number | string, password: string) {
    const hash = await passwords.hash_password(password)
    return this.db.none(sql.setPassword, { id: id, password: hash })
  }

  delete(id: number | string) {
    // TODO: What happens to user content (photos, reviews, locations, ...) ?
    return this.db.none('DELETE FROM users WHERE id = ${id}', {
      id: parseInt(String(id)),
    })
  }

  subscribe(email: string) {
    return this.db.none(sql.subscribe, { email })
  }

  unsubscribe(email: string) {
    return this.db.none(sql.unsubscribe, { email })
  }
}

export = Users

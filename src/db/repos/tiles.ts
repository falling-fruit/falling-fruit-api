import sqlModule = require('../sql')
import type { Protocol, Pgp } from '../types'

const sql = sqlModule.tiles

class Tiles {
  db: Protocol
  pgp: Pgp

  constructor(db: Protocol, pgp: Pgp) {
    this.db = db
    this.pgp = pgp
  }

  async show({
    x,
    y,
    z,
  }: {
    x: number | string
    y: number | string
    z: number | string
  }) {
    const values: {
      x: number
      y: number
      z: number
      pixels: number
      size?: number
    } = {
      x: parseInt(String(x)),
      y: parseInt(String(y)),
      z: parseInt(String(z)),
      pixels: 256,
    }
    let result = await this.db.oneOrNone(sql.get, values)
    if (!result) {
      values.size = 40075016.68 / 2 ** values.z / values.pixels
      result = await this.db.one(sql.show, values)
    }
    return result.mvt
  }
}

export = Tiles

const sql = require('../sql').tiles
const _ = require('../../helpers')

class Tiles {
  constructor(db, pgp) {
    this.db = db
    this.pgp = pgp
  }

  async show({ x, y, z }) {
    const values = {
      x: parseInt(x),
      y: parseInt(y),
      z: parseInt(z)
    }
    const result = await this.db.one(sql.show, values)
    return result.tile
  }
}

module.exports = Tiles

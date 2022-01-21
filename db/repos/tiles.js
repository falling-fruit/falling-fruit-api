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
      z: parseInt(z),
      pixels: 256
    }
    let result = await this.db.oneOrNone(sql.get, values)
    if (!result) {
      values.size = 40075016.68 / (2**values.z) / values.pixels
      result = await this.db.one(sql.show, values)
    }
    return result.mvt
  }
}

module.exports = Tiles

const path = require('path')
const test = require('node:test')

require('dotenv').config({ path: path.resolve(__dirname, '..', '.env.test') })

const makeDb = require('../src/db')

const LOCATION_TABLES = 'locations, locations_routes, observations, photos, clusters, changes'

class E2ESetup {
  constructor() {
    this.db = makeDb(process.env.DB, false)
  }

  async reset(tables) {
    await this.db.none(`TRUNCATE ${tables} RESTART IDENTITY CASCADE`)
  }

  async resetLocations() {
    await this.reset(LOCATION_TABLES)
  }

  async close() {
    await this.db.$pool.end()
  }

  register(before = () => this.resetLocations()) {
    test.before(before)
    test.after(() => this.close())
    return this
  }
}

module.exports = { E2ESetup }

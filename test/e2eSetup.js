const path = require('path')
const test = require('node:test')

require('dotenv').config({ path: path.resolve(__dirname, '..', '.env.test') })

const db = require('../src/db')

class E2ESetup {
  constructor() {
    this.db = db
  }

  async resetLocations() {
    await this.db.none('TRUNCATE locations, locations_routes, observations, photos, clusters, changes RESTART IDENTITY CASCADE')
  }

  async close() {
    await this.db.$pool.end()
  }

  register() {
    test.before(() => this.resetLocations())
    test.after(() => this.close())
    return this
  }
}

module.exports = { E2ESetup }

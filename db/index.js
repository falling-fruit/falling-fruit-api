const promise = require('bluebird')
const repos = require('./repos')
const {types} = require('pg')
const monitor = require('pg-monitor')

const options = {
  promiseLib: promise,
  extend: (obj, dc) => {
    obj.clusters = new repos.Clusters(obj, pgp)
    obj.types = new repos.Types(obj, pgp)
    obj.locations = new repos.Locations(obj, pgp)
    obj.reviews = new repos.Reviews(obj, pgp)
    obj.users = new repos.Users(obj, pgp),
    obj.reports = new repos.Reports(obj, pgp),
    obj.imports = new repos.Imports(obj, pgp)
  }
}
const pgp = require('pg-promise')(options)
monitor.attach(options)
// Return BIGINT or BIGSERIAL as JSON integers (https://stackoverflow.com/a/39176670)
pgp.pg.types.setTypeParser(types.builtins.INT8, parseInt)
// Return DATE without timestamp (YYYY-MM-DD)
pgp.pg.types.setTypeParser(types.builtins.DATE, String)
const db = pgp(process.env.DB)
module.exports = db

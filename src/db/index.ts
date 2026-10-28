import promise from 'bluebird'
import monitor from 'pg-monitor'
import repos from './repos'
import pgPromise from 'pg-promise'
import type { IInitOptions } from 'pg-promise'
import type { Db, DbRepos, Pgp } from './types'

function makeDb(
  connectionString: string | undefined,
  attachMonitor = false,
): Db {
  const options: IInitOptions<DbRepos> = {
    promiseLib: promise,
    extend: (obj, _dc) => {
      obj.clusters = new repos.Clusters(obj, pgp)
      obj.types = new repos.Types(obj, pgp)
      obj.locations = new repos.Locations(obj, pgp)
      obj.locationLists = new repos.LocationLists(obj, pgp)
      obj.reviews = new repos.Reviews(obj, pgp)
      obj.users = new repos.Users(obj, pgp)
      obj.reports = new repos.Reports(obj, pgp)
      obj.imports = new repos.Imports(obj, pgp)
      obj.photos = new repos.Photos(obj, pgp)
      obj.changes = new repos.Changes(obj, pgp)
      obj.tiles = new repos.Tiles(obj, pgp)
    },
  }
  if (attachMonitor) {
    monitor.attach(options)
  }
  const pgp: Pgp = pgPromise(options)
  // Return BIGINT or BIGSERIAL as JSON integers (https://stackoverflow.com/a/39176670)
  pgp.pg.types.setTypeParser(pgp.pg.types.builtins.INT8, parseInt)
  // Return DATE without timestamp (YYYY-MM-DD)
  pgp.pg.types.setTypeParser(pgp.pg.types.builtins.DATE, String)
  if (!connectionString) {
    throw Error('A database connection string is required')
  }
  return pgp(connectionString)
}

export default makeDb

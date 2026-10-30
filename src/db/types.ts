import type pgPromise from 'pg-promise'
import type Clusters from './repos/clusters'
import type Types from './repos/types'
import type Locations from './repos/locations'
import type LocationLists from './repos/locationLists'
import type Reviews from './repos/reviews'
import type Users from './repos/users'
import type Reports from './repos/reports'
import type Imports from './repos/imports'
import type Photos from './repos/photos'
import type Changes from './repos/changes'
import type Tiles from './repos/tiles'

/**
 * pg-promise protocol used by repositories.
 *
 * Only the base query methods (`one`, `any`, `none`, `oneOrNone`, ...) are
 * needed, so the repositories accept the base protocol rather than the full
 * extended database object.
 */
export type Protocol = pgPromise.IBaseProtocol<unknown>

/** The pg-promise main instance (provides `helpers`, `errors`, ...). */
export type Pgp = pgPromise.IMain

/** Repositories attached to the database object. */
export interface DbRepos {
  clusters: Clusters
  types: Types
  locations: Locations
  locationLists: LocationLists
  reviews: Reviews
  users: Users
  reports: Reports
  imports: Imports
  photos: Photos
  changes: Changes
  tiles: Tiles
}

/** Extended database object: the pg-promise protocol plus repositories. */
export type Db = pgPromise.IDatabase<DbRepos> & DbRepos

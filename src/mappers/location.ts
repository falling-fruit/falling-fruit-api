import type { AddLocation, Location } from '../schemas/schemas'
import type { LocationsInitializer } from '../db/generated/public/Locations'

// The database row as returned by queries: the API-shaped fields the SQL
// produces (as a partial, since queries select varying subsets and joins),
// plus the transient `no_season` column consumed by `fromRow`. Dates arrive as
// ISO strings, matching the API shape.
type LocationRow = Partial<Location> & {
  no_season?: boolean | null
} & Record<string, unknown>

export default {
  /**
   * Convert a database row into the API object.
   *
   * @param location - Raw location row.
   * @returns API-shaped location.
   */
  fromRow(location: LocationRow): Location {
    // TEMP: Replace no_season=true with season=[0, 11]
    if (location.no_season) {
      location.season_start = 0
      location.season_stop = 11
    }
    delete location.no_season
    return location as Location
  },

  /**
   * Convert an API object into a database row, applying column defaults.
   *
   * @param obj - API-shaped location (from a request body).
   * @returns Location row, ready to insert.
   */
  toRow(
    obj: Partial<AddLocation> & Record<string, unknown>,
  ): LocationsInitializer & Record<string, unknown> {
    return {
      season_start: null,
      season_stop: null,
      access: null,
      description: null,
      unverified: false,
      user_id: null,
      ...obj,
    }
  },
}

import type { AddLocation, Location } from '../schemas/schemas'
import type { default as LocationsRow, LocationsInitializer } from '../db/generated/public/Locations'

type LocationRow = Partial<LocationsRow> & {
  no_season?: boolean | null
  season_start?: number | null
  season_stop?: number | null
}

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
    return location as unknown as Location
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


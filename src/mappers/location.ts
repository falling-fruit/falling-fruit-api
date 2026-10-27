import type { AddLocation, Location } from '../schemas/schemas'

type LocationRow = Partial<Location> & {
  no_season?: boolean | null
  season_start?: number | null
  season_stop?: number | null
}

const _: {
  fromRow: (location: LocationRow) => LocationRow
  toRow: (obj: Partial<AddLocation> & Record<string, unknown>) => Record<string, unknown>
} = {} as any

/**
 * Convert a database row into the API object.
 *
 * @param location - Raw location row.
 * @returns API-shaped location.
 */
_.fromRow = function (location) {
  // TEMP: Replace no_season=true with season=[0, 11]
  if (location.no_season) {
    location.season_start = 0
    location.season_stop = 11
  }
  delete location.no_season
  return location
}

/**
 * Convert an API object into a database row, applying column defaults.
 *
 * @param obj - API-shaped location (from a request body).
 * @returns Location row, ready to insert.
 */
_.toRow = function (obj) {
  return {
    season_start: null,
    season_stop: null,
    access: null,
    description: null,
    unverified: false,
    user_id: null,
    ...obj,
  }
}

export = _

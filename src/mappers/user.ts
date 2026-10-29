import type { Polygon } from '../schemas/geojson'
import type { z } from '../schemas/registry'
import type { EditUser, User } from '../schemas/schemas'
import type { default as UsersRow } from '../db/generated/public/Users'

type PolygonType = z.infer<typeof Polygon>

// The database row as returned by queries: the API-shaped fields the SQL
// produces (as a partial), except `range` arrives as a PostGIS GeoJSON string
// and is decoded to a Polygon by this mapper.
type UserRow = Omit<Partial<User>, 'range'> & {
  range?: string | PolygonType | null
} & Record<string, unknown>

// Named parameters bound by the add/edit SQL. Columns are typed from the
// generated row, except `range`, which the SQL serializes via
// `ST_GeomFromGeoJson(${range:json})` and so is passed as a Polygon object.
type UserWriteParams = Pick<
  UsersRow,
  'name' | 'bio' | 'announcements_email'
> & {
  range: PolygonType | null
}

export default {
  /**
   * Convert a database row into the API object.
   *
   * @param user - Raw user row (with `range` as a GeoJSON string).
   * @returns API-shaped user.
   */
  fromRow(user: UserRow): User {
    if (user.range && typeof user.range === 'string') {
      user.range = JSON.parse(user.range)
    }
    return user as User
  },

  /**
   * Convert a request body into a database row, applying column defaults.
   *
   * @param body - Request body.
   * @returns User row (minus derived fields like the hashed password).
   */
  toRow(body: Partial<EditUser> & Record<string, unknown>): UserWriteParams {
    return {
      name: null,
      bio: null,
      range: null,
      announcements_email: true,
      ...body,
    }
  },
}

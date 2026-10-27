import type { Polygon } from '../schemas/geojson'
import type { z } from '../schemas/registry'
import type { EditUser, User } from '../schemas/schemas'

type PolygonType = z.infer<typeof Polygon>

type UserRow = Omit<User, 'range'> & {
  range?: string | PolygonType | null
}

const _: {
  fromRow: (user: UserRow) => UserRow
  toRow: (body: Partial<EditUser> & Record<string, unknown>) => Record<string, unknown>
} = {} as any

/**
 * Convert a database row into the API object.
 *
 * @param user - Raw user row (with `range` as a GeoJSON string).
 * @returns API-shaped user.
 */
_.fromRow = function (user) {
  if (user.range && typeof user.range === 'string') {
    user.range = JSON.parse(user.range)
  }
  return user
}

/**
 * Convert a request body into a database row, applying column defaults.
 *
 * @param body - Request body.
 * @returns User row (minus derived fields like the hashed password).
 */
_.toRow = function (body) {
  return {
    name: null,
    bio: null,
    range: null,
    announcements_email: true,
    ...body,
  }
}

export = _

import sqlModule from '../sql'
import {
  ids_to_sql,
  bounds_to_geography_sql,
  bounds_to_lnglat_sql,
  muni_to_sql,
  types_array_to_sql,
  invasive_to_sql,
} from '../../sql_formatters'
import Changes from './changes'
import Types from './types'
import Location from '../../mappers/location'
import { parse_bounds } from '../../parsers/bounds'
import type { Protocol, Pgp } from '../types'
import type {
  AddLocation,
  Location as ApiLocation,
  ListLocation,
} from '../../schemas/schemas'

const sql = sqlModule.locations

type LocationRow = Parameters<typeof Location.fromRow>[0] & { id: number }

type LocationListParams = {
  ids?: number[]
  bounds?: string[]
  center?: number[]
  muni?: boolean
  types?: number[]
  invasive?: boolean
  limit?: number
  offset?: number
  photo?: boolean
  count?: boolean
  locale?: string
}

class Locations {
  db: Protocol
  pgp: Pgp
  changes: Changes
  types: Types

  constructor(db: Protocol, pgp: Pgp) {
    this.db = db
    this.pgp = pgp
    this.changes = new Changes(db, pgp)
    this.types = new Types(db, pgp)
  }

  async add(
    obj: Partial<AddLocation> & Record<string, unknown>,
  ): Promise<ApiLocation> {
    const values = Location.toRow(obj)
    const location = await this.db.one<LocationRow>(sql.add, values)
    await this.changes.add({
      description: 'added',
      location: location,
      user_id: location.user_id,
    })
    return Location.fromRow(location)
  }

  async edit(
    id: number | string,
    obj: Record<string, unknown>,
    user: { id: number } | null,
  ): Promise<ApiLocation> {
    const values = { ...Location.toRow(obj), id: parseInt(String(id)) }
    const location = await this.db.one<LocationRow>(sql.edit, values)
    await this.changes.add({
      description: 'edited',
      location: location,
      user_id: user ? user.id : null,
    })
    return Location.fromRow(location)
  }

  async show(
    id: number | string,
    user: { id: number } | null,
  ): Promise<ApiLocation> {
    const location = await this.db.one<LocationRow>(sql.show, {
      id: parseInt(String(id)),
      user_id: user ? user.id : null,
    })
    return Location.fromRow(location)
  }

  async list(
    {
      ids = undefined,
      bounds = undefined,
      center = undefined,
      muni = true,
      types = undefined,
      invasive = false,
      limit = 1000,
      offset = 0,
      photo = false,
      locale = undefined,
    }: LocationListParams,
    user: { id: number } | null,
  ): Promise<ListLocation[]> {
    const hasIds = ids !== undefined
    const hasBounds = bounds !== undefined
    const hasCenter = center !== undefined
    if (!hasIds && !hasBounds && !hasCenter) {
      throw Error('Either ids, bounds, or center are required')
    }
    if ((types && types.length === 0) || (ids && ids.length === 0)) {
      return []
    }
    let filters
    if (ids && ids.length) {
      filters = [ids_to_sql(ids)]
    } else {
      filters = [
        'NOT hidden',
        bounds
          ? center
            ? bounds_to_geography_sql(parse_bounds(bounds), 'location')
            : bounds_to_lnglat_sql(parse_bounds(bounds))
          : null,
        muni_to_sql(muni),
        types_array_to_sql(types),
        invasive_to_sql(invasive),
      ]
    }
    const values: {
      where: string
      limit: number
      offset: number
      distance: { column: string; order: string }
      in_list: string
      names?: string
    } = {
      where: filters.filter(Boolean).join(' AND '),
      limit: limit,
      offset: offset,
      distance: { column: '', order: '' },
      in_list: '',
    }
    if (center) {
      const point = { x: center[1], y: center[0] }
      values.distance = {
        column: `,
          location <-> ST_SetSRID(
            ST_Point(${point.x}, ${point.y}), 4326
          ) as distance
        `,
        order: 'ORDER BY distance',
      }
    }
    if (user) {
      values.in_list = `,
      exists (
        select 1
        from locations_routes
        join routes on routes.id = locations_routes.route_id
        where routes.user_id = ${parseInt(String(user.id))} and locations_routes.location_id = locations.id
      ) as in_list
      `
    }
    if (photo) {
      return this.db.any<ListLocation>(sql.listphoto, values)
    }
    if (!center && locale) {
      const names = this.types.locale_to_names(locale).join(', ')
      return this.db.any<ListLocation>(sql.listname, { ...values, names: names })
    }
    return this.db.any<ListLocation>(sql.list, values)
  }

  count({
    bounds = undefined,
    muni = true,
    types = undefined,
    invasive = false,
  }: {
    bounds?: string[]
    muni?: boolean
    types?: number[]
    invasive?: boolean
  }): Promise<{ count: number }> {
    const filters = [
      'NOT hidden',
      bounds
        ? bounds_to_geography_sql(parse_bounds(bounds), 'location')
        : null,
      muni_to_sql(muni),
      types_array_to_sql(types),
      invasive_to_sql(invasive),
    ]
    const values = { where: filters.filter(Boolean).join(' AND ') }
    return this.db.one<{ count: number }>(sql.count, values)
  }

  delete(id: number | string) {
    return this.db.none('DELETE FROM locations WHERE id = ${id}', {
      id: parseInt(String(id)),
    })
  }
}

export default Locations

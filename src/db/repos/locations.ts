import sqlModule = require('../sql')
import sqlf = require('../../sql_formatters')
import Changes = require('./changes')
import Types = require('./types')
import Location = require('../../mappers/location')
import { parse_point } from '../../parsers/point'
import { parse_bounds } from '../../parsers/bounds'
import type { Protocol, Pgp } from '../types'
import type {
  AddLocation,
  Location as ApiLocation,
  ListLocation,
} from '../../schemas/schemas'

const sql = sqlModule.locations

type LocationListParams = {
  ids?: string | null
  bounds?: string | null
  center?: string | null
  muni?: string
  types?: string | null
  invasive?: string
  limit?: string
  offset?: string
  photo?: string
  locale?: string | null
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
  ): Promise<Partial<ApiLocation>> {
    const values = Location.toRow(obj)
    const location = await this.db.one(sql.add, values)
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
  ): Promise<Partial<ApiLocation>> {
    const values = { ...obj, id: parseInt(String(id)) }
    const location = await this.db.one(sql.edit, values)
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
  ): Promise<Partial<ApiLocation>> {
    const location = await this.db.one(sql.show, {
      id: parseInt(String(id)),
      user_id: user ? user.id : null,
    })
    return Location.fromRow(location)
  }

  async list(
    {
      ids = null,
      bounds = null,
      center = null,
      muni = 'true',
      types = null,
      invasive = 'false',
      limit = '1000',
      offset = '0',
      photo = 'false',
      locale = null,
    }: LocationListParams,
    user: { id: number } | null,
  ): Promise<ListLocation[]> {
    if (!ids && !bounds && !center) {
      throw Error('Either ids, bounds, or center are required')
    }
    if (types === '' || ids === '') {
      return []
    }
    let filters
    if (ids) {
      filters = [sqlf.ids_to_sql(ids)]
    } else {
      filters = [
        'NOT hidden',
        bounds
          ? center
            ? sqlf.bounds_to_geography_sql(parse_bounds(bounds), 'location')
            : sqlf.bounds_to_lnglat_sql(parse_bounds(bounds))
          : null,
        sqlf.muni_to_sql(muni),
        sqlf.types_array_to_sql(types),
        sqlf.invasive_to_sql(invasive),
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
      limit: parseInt(limit),
      offset: parseInt(offset),
      distance: { column: '', order: '' },
      in_list: '',
    }
    if (center) {
      const point = parse_point(center)
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
    if (photo === 'true') {
      return this.db.any(sql.listphoto, values)
    }
    if (!center && locale) {
      const names = this.types.locale_to_names(locale).join(', ')
      return this.db.any(sql.listname, { ...values, names: names })
    }
    return this.db.any(sql.list, values)
  }

  count({
    bounds,
    muni = 'true',
    types = null,
    invasive = 'false',
  }: {
    bounds: string
    muni?: string
    types?: string | null
    invasive?: string
  }) {
    const filters = [
      'NOT hidden',
      sqlf.bounds_to_geography_sql(parse_bounds(bounds), 'location'),
      sqlf.muni_to_sql(muni),
      sqlf.types_array_to_sql(types),
      sqlf.invasive_to_sql(invasive),
    ]
    const values = { where: filters.filter(Boolean).join(' AND ') }
    return this.db.one(sql.count, values)
  }

  delete(id: number | string) {
    return this.db.none('DELETE FROM locations WHERE id = ${id}', {
      id: parseInt(String(id)),
    })
  }
}

export = Locations

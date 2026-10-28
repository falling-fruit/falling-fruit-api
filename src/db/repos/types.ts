import sqlModule = require('../sql')
import { MAX_GRID_ZOOM } from '../../projection'
import {
  bounds_to_lnglat_sql,
  bounds_to_mercator_sql,
  muni_to_sql,
} from '../../sql_formatters'
import Type = require('../../mappers/type')
import { parse_bounds } from '../../parsers/bounds'
import type { Protocol, Pgp } from '../types'
import type { SubmitType, Type as ApiType, TypeCount } from '../../schemas/schemas'

const sql = sqlModule.types

class Types {
  db: Protocol
  pgp: Pgp
  names: string[]
  default_names: string[]

  constructor(db: Protocol, pgp: Pgp) {
    this.db = db
    this.pgp = pgp
    this.names = []
    db.any(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'types'`,
    ).then((result: { column_name: string }[]) => {
      this.names = result
        .map((row) => row.column_name)
        .filter((key) => key.endsWith('_name'))
    })
    this.default_names = ['en_name', 'scientific_name']
  }

  locale_to_names(value: string): string[] {
    const column = Type.locale_to_name(value)
    if (this.names.includes(column)) {
      return [column, ...this.default_names].filter(
        (value, index, array) => array.indexOf(value) === index,
      )
    }
    return this.default_names
  }

  async add(
    obj: Partial<SubmitType> & Record<string, unknown>,
  ): Promise<Partial<ApiType>> {
    const values = Type.toRow(obj, {
      nameColumns: this.names,
      defaultNames: this.default_names,
    })
    const type = await this.db.one(sql.add, values)
    return Type.fromRow(type)
  }

  async show(id: number | string): Promise<Partial<ApiType>> {
    const type = await this.db.one(sql.show, { id: parseInt(String(id)) })
    return Type.fromRow(type)
  }

  async list(): Promise<Partial<ApiType>[]> {
    const types = await this.db.any(sql.list)
    return types.map(Type.fromRow)
  }

  count({
    bounds,
    muni = true,
    zoom = undefined,
  }: {
    bounds: string[]
    muni?: boolean
    zoom?: number
  }): Promise<TypeCount[]> {
    let parsedZoom: number | null = zoom ?? null
    if (parsedZoom) {
      if (parsedZoom > MAX_GRID_ZOOM) {
        parsedZoom = null
      }
    }
    let filters
    let values
    if (parsedZoom === null) {
      filters = [
        'NOT hidden',
        bounds_to_lnglat_sql(parse_bounds(bounds)),
        muni_to_sql(muni),
      ]
      values = { where: filters.filter(Boolean).join(' AND ') }
      return this.db.any(sql.count, values)
    }
    filters = [
      bounds_to_mercator_sql(parse_bounds(bounds)),
      muni_to_sql(muni),
    ]
    values = { where: filters.filter(Boolean).join(' AND '), zoom: parsedZoom }
    return this.db.any(sql.countClusters, values)
  }
}

export = Types

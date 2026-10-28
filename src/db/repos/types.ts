import sqlModule from '../sql'
import { MAX_GRID_ZOOM } from '../../projection'
import {
  bounds_to_lnglat_sql,
  bounds_to_mercator_sql,
  muni_to_sql,
} from '../../sql_formatters'
import Type from '../../mappers/type'
import { parse_bounds } from '../../parsers/bounds'
import type { Protocol, Pgp } from '../types'
import type { SubmitType, Type as ApiType, TypeCount } from '../../schemas/schemas'

const sql = sqlModule.types

type TypeRow = Parameters<typeof Type.fromRow>[0]

class Types {
  db: Protocol
  pgp: Pgp
  names: string[]
  default_names: string[]

  constructor(db: Protocol, pgp: Pgp) {
    this.db = db
    this.pgp = pgp
    this.names = []
    db.any<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'types'`,
    ).then((result) => {
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
  ): Promise<ApiType> {
    const values = Type.toRow(obj, {
      nameColumns: this.names,
      defaultNames: this.default_names,
    })
    const type = await this.db.one<TypeRow>(sql.add, values)
    return Type.fromRow(type)
  }

  async show(id: number | string): Promise<ApiType> {
    const type = await this.db.one<TypeRow>(sql.show, { id: parseInt(String(id)) })
    return Type.fromRow(type)
  }

  async list(): Promise<ApiType[]> {
    const types = await this.db.any<TypeRow>(sql.list)
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
      return this.db.any<TypeCount>(sql.count, values)
    }
    filters = [
      bounds_to_mercator_sql(parse_bounds(bounds)),
      muni_to_sql(muni),
    ]
    values = { where: filters.filter(Boolean).join(' AND '), zoom: parsedZoom }
    return this.db.any<TypeCount>(sql.countClusters, values)
  }
}

export default Types

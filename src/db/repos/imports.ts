import sqlModule from '../sql'
import { bounds_to_lnglat_sql, muni_to_sql } from '../../sql_formatters'
import { parse_bounds } from '../../parsers/bounds'
import type { Protocol, Pgp } from '../types'
import type { Import } from '../../schemas/schemas'

const sql = sqlModule.imports

class Imports {
  db: Protocol
  pgp: Pgp

  constructor(db: Protocol, pgp: Pgp) {
    this.db = db
    this.pgp = pgp
  }

  async show(id: number | string): Promise<Import> {
    return await this.db.one<Import>(sql.show, { id: parseInt(String(id)) })
  }

  async list(): Promise<Import[]> {
    return await this.db.any<Import>(sql.list)
  }

  count({ bounds, muni = true }: { bounds: string[]; muni?: boolean }): Promise<{ id: number; count: number }[]> {
    const filters = [
      'NOT hidden',
      bounds_to_lnglat_sql(parse_bounds(bounds)),
      muni_to_sql(muni),
    ]
    const values = { where: filters.filter(Boolean).join(' AND ') }
    return this.db.any<{ id: number; count: number }>(sql.count, values)
  }
}

export default Imports

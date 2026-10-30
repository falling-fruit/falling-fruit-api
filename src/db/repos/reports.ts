import sqlModule from '../sql'
import type { Protocol, Pgp } from '../types'
import type { EditReport, Report } from '../../schemas/schemas'

const sql = sqlModule.reports

class Reports {
  db: Protocol
  pgp: Pgp

  constructor(db: Protocol, pgp: Pgp) {
    this.db = db
    this.pgp = pgp
  }

  add(obj: EditReport & Record<string, unknown>): Promise<Report> {
    const values = {
      comment: null,
      name: null,
      reporter_id: null,
      ...obj,
    }
    return this.db.one<Report>(sql.add, values)
  }
}

export default Reports

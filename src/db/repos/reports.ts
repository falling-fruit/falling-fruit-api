import sqlModule from '../sql'
import type { Protocol, Pgp } from '../types'
import type { EditReport, Report, OpenReport } from '../../schemas/schemas'

const sql = sqlModule.reports

type Viewer = { id: number; roles: string[] } | null

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

  listOpenForLocation(
    locationId: number | string,
    viewer: Viewer,
  ): Promise<OpenReport[]> {
    const isAdmin = !!viewer && viewer.roles.includes('admin')
    const columnFragments: string[] = []
    if (viewer) {
      columnFragments.push(
        this.pgp.as.format(
          ', COALESCE(p.reporter_id = ${user_id}, false) AS reported_by_me',
          { user_id: viewer.id },
        ),
      )
    }
    if (isAdmin) {
      columnFragments.push(
        ", p.comment AS comment, json_build_object('user_id', p.reporter_id, 'name', p.name, 'email', p.email) AS reporter",
      )
    }
    return this.db.any<OpenReport>(sql.listOpenForLocation, {
      location_id: parseInt(String(locationId)),
      columns: columnFragments.join(''),
    })
  }
}

export default Reports

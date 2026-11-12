import sqlModule from '../sql'
import type { Protocol, Pgp } from '../types'
import type {
  EditReport,
  Report,
  AdminReport,
  ResolvedReport,
} from '../../schemas/schemas'

const sql = sqlModule.reports

type ListResolvedParams = {
  q?: string
  problem_code?: number
  resolution_code?: number
  sort?: 'newest' | 'oldest'
  limit?: number
  offset?: number
}

type ResolveParams = {
  resolution_code: number
  response: string | null
  responder_id: number
}

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

  listOpen(): Promise<AdminReport[]> {
    return this.db.any<AdminReport>(sql.listOpen)
  }

  listResolved({
    q,
    problem_code,
    resolution_code,
    sort = 'newest',
    limit = 100,
    offset = 0,
  }: ListResolvedParams): Promise<ResolvedReport[]> {
    const search = q && q.trim() !== '' ? q.trim() : null
    return this.db.any<ResolvedReport>(sql.listResolved, {
      problem_code: problem_code ?? null,
      resolution_code: resolution_code ?? null,
      search,
      search_like: search === null ? null : `%${search}%`,
      sort_direction: sort === 'oldest' ? 'ASC' : 'DESC',
      limit,
      offset,
    })
  }

  listByIds(ids: number[]): Promise<Report[]> {
    if (!ids.length) {
      return Promise.resolve([])
    }
    return this.db.any<Report>(sql.listByIds, { ids })
  }

  resolveMany(ids: number[], obj: ResolveParams): Promise<Report[]> {
    if (!ids.length) {
      return Promise.resolve([])
    }
    return this.db.any<Report>(sql.resolveMany, {
      ids,
      resolution_code: obj.resolution_code,
      response: obj.response,
      responder_id: obj.responder_id,
    })
  }

  async photoLocationId(photoId: number): Promise<number | null> {
    const row = await this.db.oneOrNone<{ location_id: number | null }>(
      sql.photoLocationId,
      { id: photoId },
    )
    if (!row) {
      throw Error(`Photo ${photoId} not found`)
    }
    return row.location_id
  }

  async reviewLocationIds(
    reviewIds: number[],
  ): Promise<Map<number, number | null>> {
    const rows = await this.db.any<{ id: number; location_id: number | null }>(
      sql.reviewLocationIds,
      { ids: reviewIds },
    )
    const byId = new Map<number, number | null>()
    for (const row of rows) {
      byId.set(row.id, row.location_id)
    }
    const missing = reviewIds.filter((id) => !byId.has(id))
    if (missing.length) {
      throw Error(`Review(s) ${missing.join(', ')} not found`)
    }
    return byId
  }
}

export default Reports

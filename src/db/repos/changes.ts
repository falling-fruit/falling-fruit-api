import sqlModule from '../sql'
import * as dates from '../../parsers/date'
import type { Protocol, Pgp } from '../types'
import type { LocationChange } from '../../schemas/schemas'

const sql = sqlModule.changes

type ChangeLocation = { id: number; [key: string]: unknown }
type ChangeReview = {
  id: number
  location_id: number
  [key: string]: unknown
}

class Changes {
  db: Protocol
  pgp: Pgp

  constructor(db: Protocol, pgp: Pgp) {
    this.db = db
    this.pgp = pgp
  }

  list({
    earliest = null,
    latest = null,
    user_id = null,
    range = false,
  }: {
    earliest?: string | null
    latest?: string | null
    user_id?: number | null
    range?: boolean
  }): Promise<LocationChange[]> {
    earliest = dates.parse_datetime(earliest)
    latest = dates.parse_datetime(latest)
    const filters = ['NOT l.hidden']
    if (earliest) {
      filters.push(`c.created_at >= '${earliest}'::timestamptz`)
    }
    if (latest) {
      filters.push(`c.created_at < '${latest}'::timestamptz`)
    }
    if (user_id) {
      let user_filter
      if (range) {
        user_filter = `ST_INTERSECTS(l.location, (SELECT range FROM users u2 WHERE u2.id = ${user_id}))`
      } else {
        user_filter = `c.user_id = ${user_id}`
      }
      filters.push(user_filter)
    }
    const values = { where: filters.join(' AND ') }
    return this.db.any<LocationChange>(sql.list, values)
  }

  add({
    description,
    location = null,
    review = null,
    user_id = null,
  }: {
    description: string
    location?: ChangeLocation | null
    review?: ChangeReview | null
    user_id?: number | null
  }) {
    const is_review = description === 'visited'
    const location_id = is_review ? review?.location_id : location?.id
    if (location_id == null) {
      throw Error(
        is_review
          ? 'A review with a location_id is required for a "visited" change'
          : 'A location with an id is required for this change',
      )
    }
    const values = {
      description: description,
      location: location,
      location_id: location_id,
      review: review,
      review_id: review ? review.id : null,
      user_id: user_id,
    }
    return this.db.none(sql.add, values)
  }

  list_location_edits(id: number | string) {
    return this.db.any<{ user_id: number | null }>(
      "SELECT * FROM changes WHERE location_id = ${id} and description = 'edited'",
      { id: parseInt(String(id)) },
    )
  }

  edit_review(review_id: number | string, review: unknown) {
    return this.db.none(
      'UPDATE changes SET review = ${review:json}, updated_at = NOW() WHERE observation_id = ${review_id}',
      { review_id: parseInt(String(review_id)), review: review },
    )
  }
}

export default Changes

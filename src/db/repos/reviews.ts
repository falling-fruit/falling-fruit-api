import sqlModule from '../sql'
import Changes from './changes'
import type { Protocol, Pgp } from '../types'
import type { EditReview, Review } from '../../schemas/schemas'

const sql = sqlModule.reviews

class Reviews {
  db: Protocol
  pgp: Pgp
  changes: Changes

  constructor(db: Protocol, pgp: Pgp) {
    this.db = db
    this.pgp = pgp
    this.changes = new Changes(db, pgp)
  }

  async add(
    id: number | string,
    obj: Partial<EditReview> & Record<string, unknown>,
  ): Promise<Review> {
    const values = {
      observed_on: null,
      comment: null,
      fruiting: null,
      quality_rating: null,
      yield_rating: null,
      user_id: null,
      ...obj,
      location_id: parseInt(String(id)),
    }
    // Assumes validation by middleware.test_review
    const review = await this.db.one<Review>(sql.add, values)
    await this.changes.add({
      description: 'visited',
      review: review,
      user_id: review.user_id,
    })
    return review
  }

  show(id: number | string): Promise<Review> {
    return this.db.one<Review>(sql.show, { id: parseInt(String(id)) })
  }

  async edit(
    id: number | string,
    obj: Partial<EditReview> & Record<string, unknown>,
  ): Promise<Review> {
    const values = {
      observed_on: null,
      comment: null,
      fruiting: null,
      quality_rating: null,
      yield_rating: null,
      ...obj,
      id: parseInt(String(id)),
    }
    const review = await this.db.one<Review>(sql.edit, values)
    await this.changes.edit_review(id, review)
    return review
  }

  list(id: number | string): Promise<Review[]> {
    return this.db.any<Review>(sql.list, { id: parseInt(String(id)) })
  }

  delete(id: number | string) {
    return this.db.none('DELETE FROM observations WHERE id = ${id}', {
      id: parseInt(String(id)),
    })
  }
}

export default Reviews

const sql = require('../sql').types
const _ = require('../../helpers')

class Types {
  constructor(db, pgp) {
    this.db = db
    this.pgp = pgp
  }

  async add(obj) {
    let values = {
      parent_id: null,
      common_names: {},
      scientific_names: [],
      taxonomic_rank: null,
      notes: null,
      pending: true,
      ...obj
    }
    values = {
      en_name: null,
      en_synonyms: null,
      scientific_name: null,
      scientific_synonymss: null,
      ..._.deconstruct_type(values)
    }
    console.log(values)
    if (!values.en_name && !values.scientific_name) {
      throw Error('At least one scientific name or (en) common name is required')
    }
    // TODO: Check for existing matching types
    const type = await this.db.one(sql.add, values)
    return _.format_type(type)
  }

  async show(id) {
    const type = await this.db.one(sql.show, {id: parseInt(id)})
    return _.format_type(type)
  }

  async list() {
    const types = await this.db.any(sql.list)
    return types.map(_.format_type)
  }

  count({bounds, muni = 'true'}) {
    const filters = [
      "NOT hidden",
      _.bounds_to_sql(_.parse_bounds(bounds)),
      _.muni_to_sql(muni)
    ]
    const values = {where: filters.filter(Boolean).join(' AND ')}
    return this.db.any(sql.count, values)
  }
}

module.exports = Types

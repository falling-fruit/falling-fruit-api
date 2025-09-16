const sql = require('../sql').types
const _ = require('../../helpers')

class Types {
  constructor(db, pgp) {
    this.db = db
    this.pgp = pgp
    // Load name columns from db
    db.any('SELECT * FROM types LIMIT 1').then(result => {
      this.names = Object.keys(result[0]).filter(
        key => key.endsWith('_name')
      )
    })
    this.default_names = ['en_name', 'scientific_name']
  }

  locale_to_names(value) {
    const column = _.locale_to_name(value)
    if (this.names.includes(column)) {
      return [column, ...this.default_names].filter(
        (value, index, array) => array.indexOf(value) === index
      )
    }
    return this.default_names
  }

  async add(obj) {
    let values = {
      parent_id: null,
      common_names: {},
      scientific_names: [],
      taxonomic_rank: null,
      notes: null,
      pending: true,
      categories: [],
      user_id: null,
      ...obj
    }
    values = {
      ...Object.fromEntries(this.names.map(x => [x, null])),
      en_synonyms: null,
      scientific_synonyms: null,
      category_mask: null,
      ..._.deconstruct_type(values)
    }
    // Determine whether default name is present
    let has_default = this.default_names.some(name => Boolean(values[name]))
    // Transfer non-English names to a language_name column, if it exists, or to notes
    for (const [locale, names] of Object.entries(values.common_names)) {
      const column = _.locale_to_name(locale)
      if (this.names.includes(column)) {
        values[column] = names.join(', ')
      } else {
        values.notes = [
          values.notes || '', `common_names.${locale}: ${names.join(', ')}`
        ].filter(Boolean).join('\n')
      }
      // Use first name as default if no default name is present
      if (!has_default) {
        values[this.default_names[0]] = names[0]
        has_default = true
      }
    }
    delete values.common_names
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

  count({bounds, muni = 'true', zoom = null}) {
    if (zoom) {
      zoom = parseInt(zoom)
      if (zoom > _.MAX_GRID_ZOOM) {
        zoom = null
      }
    }
    let filters
    let values
    if (zoom === null) {
      filters = [
        "NOT hidden",
        _.bounds_to_sql(_.parse_bounds(bounds)),
        _.muni_to_sql(muni)
      ]
      values = {where: filters.filter(Boolean).join(' AND ')}
      return this.db.any(sql.count, values)
    }
    filters = [
      _.bounds_to_sql(_.parse_bounds(bounds), { mercator: true }),
      _.muni_to_sql(muni)
    ]
    values = {where: filters.filter(Boolean).join(' AND '), zoom: zoom}
    return this.db.any(sql.countClusters, values)
  }
}

module.exports = Types

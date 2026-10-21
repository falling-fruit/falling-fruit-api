const sql = require('../sql').types
const projection = require('../../projection')
const sqlf = require('../../sql_formatters')
const Type = require('../../mappers/type')
const { parse_bounds } = require('../../parsers/bounds')

class Types {
  constructor(db, pgp) {
    this.db = db
    this.pgp = pgp
    db.any(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'types'`
    ).then(result => {
      this.names = result
        .map(row => row.column_name)
        .filter(key => key.endsWith('_name'))
    })
    this.default_names = ['en_name', 'scientific_name']
  }

  locale_to_names(value) {
    const column = Type.locale_to_name(value)
    if (this.names.includes(column)) {
      return [column, ...this.default_names].filter(
        (value, index, array) => array.indexOf(value) === index
      )
    }
    return this.default_names
  }

  async add(obj) {
    const values = Type.toRow(obj, {
      nameColumns: this.names,
      defaultNames: this.default_names
    })
    const type = await this.db.one(sql.add, values)
    return Type.fromRow(type)
  }

  async show(id) {
    const type = await this.db.one(sql.show, {id: parseInt(id)})
    return Type.fromRow(type)
  }

  async list() {
    const types = await this.db.any(sql.list)
    return types.map(Type.fromRow)
  }

  count({bounds, muni = 'true', zoom = null}) {
    if (zoom) {
      zoom = parseInt(zoom)
      if (zoom > projection.MAX_GRID_ZOOM) {
        zoom = null
      }
    }
    let filters
    let values
    if (zoom === null) {
      filters = [
        "NOT hidden",
        sqlf.bounds_to_lnglat_sql(parse_bounds(bounds)),
        sqlf.muni_to_sql(muni)
      ]
      values = {where: filters.filter(Boolean).join(' AND ')}
      return this.db.any(sql.count, values)
    }
    filters = [
      sqlf.bounds_to_mercator_sql(parse_bounds(bounds)),
      sqlf.muni_to_sql(muni)
    ]
    values = {where: filters.filter(Boolean).join(' AND '), zoom: zoom}
    return this.db.any(sql.countClusters, values)
  }
}

module.exports = Types

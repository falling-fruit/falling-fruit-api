const sql = require('../sql').clusters
const _ = require('../../helpers')

class Clusters {
  constructor(db, pgp) {
    this.db = db
    this.pgp = pgp
    this.cs_update = new pgp.helpers.ColumnSet(
      ['?id', 'x', 'y', 'count', {name: 'updated_at', mod: '^', def: 'NOW()'}], {table: 'clusters'}
    )
    this.cs_insert = new pgp.helpers.ColumnSet(
      ['geohash', 'zoom', 'type_id', 'muni', 'x', 'y', 'count'],
      {table: 'clusters'}
    )
  }

  list({bounds, zoom = '0', muni = 'true', types = null}) {
    if (types === '') {
      return []
    }
    const filters = [
      _.bounds_to_sql(_.parse_bounds(bounds, true), true),
      _.zoom_to_sql(zoom),
      _.muni_to_sql(muni),
      _.types_to_sql(types)
    ]
    const values = {where: filters.filter(Boolean).join(' AND ')}
    return this.db.any(sql.list, values)
  }

  async increment({lng, lat, type_ids, muni = false}) {
    // Convert lng, lat to geohash
    const mercator = _.wgs84_to_mercator({x: lng, y: lat})
    const geohash = _.gridcell_to_geohash(
      _.mercator_to_gridcell(mercator)
    )
    // Expand geohash
    const geohashes = _.expand_geohash(geohash)
    // Increment existing clusters
    const clusters = await this.db.any(
      'SELECT id, x, y, count FROM clusters WHERE ${muni:raw} geohash IN (${geohashes:csv}) AND type_id IN (${type_ids:csv})',
      {muni: muni ? 'muni AND' : '', geohashes: geohashes, type_ids: type_ids}
    )
    clusters.forEach(c => {
      const center = _.move_cluster({cx: c.x, cy: c.y}, c.count, mercator, 1)
      c.x = center.x
      c.y = center.y
      c.count += 1
    })
    if (clusters.length) {
      await this.db.none(
        `${this.pgp.helpers.update(clusters, this.cs_update)} WHERE v.id = t.id`
      )
    }
    // Create missing clusters
    const missing = []
    for (const type_id of type_ids) {
      const hashes = clusters.reduce((hashes, cluster) => {
        if (cluster.type_id === type_id) {
          hashes.push(cluster.geohash)
        }
        return hashes
      }, [])
      for (const hash of geohashes) {
        if (!hashes.includes(hash)) {
          missing.push({
            geohash: hash,
            zoom: _.geohash_to_zoom(hash),
            type_id: type_id,
            muni: muni,
            x: mercator.x,
            y: mercator.y,
            count: 1
          })
        }
      }
    }
    if (missing.length) {
      await this.db.none(this.pgp.helpers.insert(missing, this.cs_insert))
    }
  }

  async decrement({lng, lat, type_ids, muni = false}) {
    // Convert lng, lat to geohash
    const mercator = _.wgs84_to_mercator({x: lng, y: lat})
    const geohash = _.gridcell_to_geohash(
      _.mercator_to_gridcell(mercator)
    )
    // Expand geohash
    const geohashes = _.expand_geohash(geohash)
    // Delete singleton clusters
    await this.db.none(
      'DELETE FROM clusters WHERE ${muni:raw} geohash IN (${geohashes:csv}) AND type_id IN (${type_ids:csv}) AND count = 1',
      {muni: muni ? 'muni AND' : '', geohashes: geohashes, type_ids: type_ids}
    )
    // Decrement and move remaining clusters
    const clusters = await this.db.any(
      'SELECT id, x, y, count FROM clusters WHERE ${muni:raw} geohash IN (${geohashes:csv}) AND type_id IN (${type_ids:csv})',
      {muni: muni ? 'muni AND' : '', geohashes: geohashes, type_ids: type_ids}
    )
    clusters.forEach(c => {
      const center = _.move_cluster({cx: c.x, cy: c.y}, c.count, mercator, -1)
      c.x = center.x
      c.y = center.y
      c.count -= 1
    })
    if (clusters.length) {
      await this.db.none(
        `${this.pgp.helpers.update(clusters, this.cs_update)} WHERE v.id = t.id`
      )
    } else {
      console.error('No clusters to decrement')
    }
  }
}

module.exports = Clusters

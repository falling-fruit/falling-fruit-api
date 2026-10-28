import sqlModule from '../sql'
import { wgs84_to_mercator } from '../../projection'
import {
  gridcell_to_geohash,
  mercator_to_gridcell,
  expand_geohash,
  move_cluster,
  geohash_to_zoom,
} from '../../clustering'
import {
  bounds_to_mercator_sql,
  zoom_to_sql,
  muni_to_sql,
  types_to_sql,
} from '../../sql_formatters'
import { parse_bounds } from '../../parsers/bounds'
import type pgPromise from 'pg-promise'
import type { Protocol, Pgp } from '../types'
import type { Cluster } from '../../schemas/schemas'

type ColumnSet = pgPromise.ColumnSet

const sql = sqlModule.clusters

type ClusterRow = {
  id: number
  x: number
  y: number
  count: number
  type_id: number
  geohash: string
}

class Clusters {
  db: Protocol
  pgp: Pgp
  cs_update: ColumnSet
  cs_insert: ColumnSet

  constructor(db: Protocol, pgp: Pgp) {
    this.db = db
    this.pgp = pgp
    this.cs_update = new pgp.helpers.ColumnSet(
      ['?id', 'x', 'y', 'count', { name: 'updated_at', mod: '^', def: 'NOW()' }],
      { table: 'clusters' },
    )
    this.cs_insert = new pgp.helpers.ColumnSet(
      ['geohash', 'zoom', 'type_id', 'muni', 'x', 'y', 'count'],
      { table: 'clusters' },
    )
  }

  list({
    bounds,
    zoom = 0,
    muni = true,
    types = undefined,
  }: {
    bounds: string[]
    zoom?: number
    muni?: boolean
    types?: number[]
  }): Promise<Cluster[]> | Cluster[] {
    if (types && types.length === 0) {
      return []
    }
    const filters = [
      bounds_to_mercator_sql(parse_bounds(bounds)),
      zoom_to_sql(zoom),
      muni_to_sql(muni),
      types_to_sql(types),
    ]
    const values = { where: filters.filter(Boolean).join(' AND ') }
    return this.db.any<Cluster>(sql.list, values)
  }

  async increment({
    lng,
    lat,
    type_ids,
    muni = false,
  }: {
    lng: number
    lat: number
    type_ids: number[]
    muni?: boolean
  }) {
    // Convert lng, lat to geohash
    const mercator = wgs84_to_mercator({ x: lng, y: lat })
    const geohash = gridcell_to_geohash(mercator_to_gridcell(mercator))
    // Expand geohash
    const geohashes = expand_geohash(geohash)
    // Increment existing clusters
    const clusters: ClusterRow[] = await this.db.any<ClusterRow>(
      'SELECT id, x, y, count, type_id, geohash FROM clusters WHERE ${muni:raw} geohash IN (${geohashes:csv}) AND type_id IN (${type_ids:csv})',
      {
        muni: `${muni ? '' : 'NOT'} muni AND`,
        geohashes: geohashes,
        type_ids: type_ids,
      },
    )
    clusters.forEach((c) => {
      const center = move_cluster({ cx: c.x, cy: c.y }, c.count, mercator, 1)
      c.x = center.x
      c.y = center.y
      c.count += 1
    })
    if (clusters.length) {
      await this.db.none(
        `${this.pgp.helpers.update(clusters, this.cs_update)} WHERE v.id = t.id`,
      )
    }
    // Create missing clusters
    const missing: {
      geohash: string
      zoom: number
      type_id: number
      muni: boolean
      x: number
      y: number
      count: number
    }[] = []
    for (const type_id of type_ids) {
      const hashes = clusters.reduce((hashes: string[], cluster) => {
        if (cluster.type_id === type_id) {
          hashes.push(cluster.geohash)
        }
        return hashes
      }, [])
      for (const hash of geohashes) {
        if (!hashes.includes(hash)) {
          missing.push({
            geohash: hash,
            zoom: geohash_to_zoom(hash),
            type_id: type_id,
            muni: muni,
            x: mercator.x,
            y: mercator.y,
            count: 1,
          })
        }
      }
    }
    if (missing.length) {
      await this.db.none(this.pgp.helpers.insert(missing, this.cs_insert))
    }
  }

  async decrement({
    lng,
    lat,
    type_ids,
    muni = false,
  }: {
    lng: number
    lat: number
    type_ids: number[]
    muni?: boolean
  }) {
    // Convert lng, lat to geohash
    const mercator = wgs84_to_mercator({ x: lng, y: lat })
    const geohash = gridcell_to_geohash(mercator_to_gridcell(mercator))
    // Expand geohash
    const geohashes = expand_geohash(geohash)
    // Delete singleton clusters
    await this.db.none(
      'DELETE FROM clusters WHERE ${muni:raw} geohash IN (${geohashes:csv}) AND type_id IN (${type_ids:csv}) AND count = 1',
      {
        muni: `${muni ? '' : 'NOT'} muni AND`,
        geohashes: geohashes,
        type_ids: type_ids,
      },
    )
    // Decrement and move remaining clusters
    const clusters = await this.db.any<Pick<ClusterRow, 'id' | 'x' | 'y' | 'count'>>(
      'SELECT id, x, y, count FROM clusters WHERE ${muni:raw} geohash IN (${geohashes:csv}) AND type_id IN (${type_ids:csv})',
      {
        muni: `${muni ? '' : 'NOT'} muni AND`,
        geohashes: geohashes,
        type_ids: type_ids,
      },
    )
    clusters.forEach((c) => {
      const center = move_cluster({ cx: c.x, cy: c.y }, c.count, mercator, -1)
      c.x = center.x
      c.y = center.y
      c.count -= 1
    })
    if (clusters.length) {
      await this.db.none(
        `${this.pgp.helpers.update(clusters, this.cs_update)} WHERE v.id = t.id`,
      )
    } else {
      console.error('No clusters to decrement')
    }
  }
}

export default Clusters

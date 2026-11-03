// Clustering: Mercator-only spatial indexing and centroid math.
//
// By contract, every function here takes Web Mercator meters (never WGS84
// degrees). Callers must project with src/projection first. Outputs are grid
// cells, geohashes, and cluster centroids in Mercator meters.

import { EARTH_CIRCUMFERENCE, MAX_GRID_ZOOM } from './projection/constants'
import type { Point } from './parsers/point'

/** Grid cell indices at a given zoom level. */
export type GridCell = {
  x: number
  y: number
  zoom: number
}

/**
 * Web Mercator (SRID 900913) to grid cell indices.
 */
export function mercator_to_gridcell(
  { x, y }: Point,
  zoom = MAX_GRID_ZOOM,
): GridCell {
  const cell_size = EARTH_CIRCUMFERENCE / 2 ** zoom
  // Move origin to bottom left corner
  // Convert to grid cell number
  return {
    x: Math.floor((x + EARTH_CIRCUMFERENCE / 2) / cell_size),
    y: Math.floor((y + EARTH_CIRCUMFERENCE / 2) / cell_size),
    zoom: zoom,
  }
}

export function gridcell_to_geohash({ x, y, zoom }: GridCell): string {
  // Convert to binary
  const xb = x.toString(2).padStart(zoom + 1, '0')
  const yb = y.toString(2).padStart(zoom + 1, '0')
  // Build hash
  let geohash = ''
  for (let i = 0; i < xb.length; i++) {
    geohash += xb[i] + yb[i]
  }
  return geohash
}

export function expand_geohash(geohash: string): string[] {
  const geohashes: string[] = []
  for (let i = geohash.length; i > 0; i -= 2) {
    geohashes.push(geohash.substring(0, i))
  }
  return geohashes
}

export function geohash_to_zoom(geohash: string): number {
  return geohash.length / 2 - 1
}

function weighted_mean(values: number[], weights: number[]): number {
  const [value, weight] = values
    .map((value, i): [number, number] => [value, weights[i]])
    .reduce(
      ([value_sum, weight_sum], [value, weight]) => {
        return [value_sum + value * weight, weight_sum + weight]
      },
      [0, 0],
    )
  return value / weight
}

export function move_cluster(
  { cx, cy }: { cx: number; cy: number },
  n: number,
  { x, y }: Point,
  add: number,
): Point {
  return {
    x: weighted_mean([cx, x], [n, add]),
    y: weighted_mean([cy, y], [n, add]),
  }
}

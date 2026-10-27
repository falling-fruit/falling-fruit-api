import { MAX_GRID_ZOOM, wgs84_to_mercator } from './projection'
import type { Point } from './parsers/point'

export function muni_to_sql(value: string | null | undefined): string | undefined {
  if (value == 'false') {
    return 'NOT muni'
  }
}

export function invasive_to_sql(
  value: string | null | undefined,
): string | undefined {
  if (value == 'true') {
    return 'invasive'
  }
}

export function ids_to_sql(value: string | null | undefined): string | undefined {
  // '1,2,3'
  if (value) {
    return `id IN (${value})`
  }
}

export function types_to_sql(
  value: string | null | undefined,
): string | undefined {
  // '1,2,3'
  if (value) {
    return `type_id IN (${value})`
  }
}

export function types_array_to_sql(
  value: string | null | undefined,
): string | undefined {
  // '1,2,3'
  if (value) {
    // Sorting shown to reduce db time 4x (?!). Requires intarray extension.
    return `type_ids && sort(ARRAY[${value}])`
  }
}

/**
 * Convert bounding box to a PostGIS SQL condition on a geometry/geography column.
 *
 * @param bounds - Bounding box (WGS84).
 * @param geography - Name of the WGS84 geometry/geography column.
 * @param epsg - SRID of the envelope.
 * @returns SQL condition.
 */
export function bounds_to_geography_sql(
  bounds: Point[],
  geography: string,
  epsg = 4326,
): string {
  return (
    `${geography} && ST_MakeEnvelope(` +
    `${bounds[0].x}, ${bounds[0].y}, ${bounds[1].x}, ${bounds[1].y}, ${epsg})`
  )
}

/**
 * Convert bounding box to a SQL condition on `lng` and `lat` columns (WGS84).
 *
 * @param bounds - Bounding box (WGS84).
 * @returns SQL condition.
 */
export function bounds_to_lnglat_sql(bounds: Point[]): string {
  const operator = bounds[1].x > bounds[0].x ? 'AND' : 'OR'
  return (
    `(lng > ${bounds[0].x} ${operator} lng < ${bounds[1].x}) AND ` +
    `(lat > ${bounds[0].y} AND lat < ${bounds[1].y})`
  )
}

/**
 * Convert bounding box to a SQL condition on cached mercator `x` and `y` columns.
 *
 * @param bounds - Bounding box (WGS84), projected to Web Mercator here.
 * @returns SQL condition.
 */
export function bounds_to_mercator_sql(bounds: Point[]): string {
  const mercator = bounds.map((point) => wgs84_to_mercator(point, true))
  const operator = mercator[1].x > mercator[0].x ? 'AND' : 'OR'
  return (
    `(x > ${mercator[0].x} ${operator} x < ${mercator[1].x}) AND ` +
    `(y > ${mercator[0].y} AND y < ${mercator[1].y})`
  )
}

export function zoom_to_sql(value: string | number): string {
  const zoom = parseInt(String(value))
  if (zoom < 0 || zoom > MAX_GRID_ZOOM) {
    throw Error(`Zoom not in interval [0, ${MAX_GRID_ZOOM}]`)
  }
  return `zoom = ${zoom}`
}

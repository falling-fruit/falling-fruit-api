// Parser for a single point request parameter (WGS84 'lat,lng').

/**
 * Point coordinates.
 *
 * The API's GeoJSON `Point` schema represents coordinates as an array, so there
 * is no Zod schema for this internal `{ x, y }` representation.
 */
export type Point = {
  /** Easting (m) or longitude (degrees). */
  x: number
  /** Northing (m) or latitude (degrees). */
  y: number
}

/**
 * Parse point coordinates.
 *
 * @param value - Coordinates in the format 'lat,lng' (WGS84 decimal degrees).
 * Expects longitude in interval [-180, 180] and latitude in interval [-90, 90].
 * @returns Parsed point in WGS84 decimal degrees.
 */
export function parse_point(value: string): Point {
  const latlng = value.split(',').map(parseFloat)
  if (latlng.length != 2 || latlng.some(isNaN)) {
    throw Error('Coordinates not in the format {latitude},{longitude}')
  }
  const point = { x: latlng[1], y: latlng[0] }
  const max = { x: 180, y: 90 }
  if (Math.abs(point.x) > max.x) {
    throw Error(`Longitude not in the interval [-${max.x}, ${max.x}]`)
  }
  if (Math.abs(point.y) > max.y) {
    throw Error(`Latitude not in the interval [-${max.y}, ${max.y}]`)
  }
  return point
}

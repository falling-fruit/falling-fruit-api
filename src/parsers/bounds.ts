// Parser for a bounding-box request parameter (WGS84 'swlat,swlng|nelat,nelng').

import { type Point, parse_point } from './point'

/**
 * Parse bounding box coordinates.
 *
 * @param value - Bounds as two WGS84 `lat,lng` strings
 * (`[swlat,swlng, nelat,nelng]`), already split from the `swlat,swlng|nelat,nelng`
 * query format.
 * @returns Parsed points in WGS84 decimal degrees.
 */
export function parse_bounds(value: string[]): Point[] {
  const points = value.map((x) => parse_point(x))
  if (points.length != 2) {
    throw Error('Bounds not in the format {lat},{lng}|{lat},{lng}')
  }
  if (points[0].y > points[1].y) {
    throw Error('Bounds not in the format {swlat},{swlng}|{nelat},{nelng}')
  }
  return points
}

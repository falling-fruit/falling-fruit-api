import {
  EARTH_RADIUS,
  EARTH_CIRCUMFERENCE,
  MAX_LATITUDE,
  MAX_GRID_ZOOM,
} from './constants'
import type { Point } from '../parsers/point'

/**
 * Transform point from WGS84 to Web Mercator.
 *
 * @param point - Point (WGS84) with latitude in interval [-85.0511, 85.0511].
 * @param clip - Whether to clip out of bound latitude to interval.
 * @returns Point (Web Mercator).
 */
export function wgs84_to_mercator({ x, y }: Point, clip = false): Point {
  if (clip) {
    y = Math.sign(y) * Math.min(Math.abs(y), MAX_LATITUDE)
  }
  if (Math.abs(y) > MAX_LATITUDE) {
    throw Error(`Latitude not in the interval [-${MAX_LATITUDE}, ${MAX_LATITUDE}]`)
  }
  return {
    x: (x / 360) * EARTH_CIRCUMFERENCE,
    y: Math.log(Math.tan((y + 90) * (Math.PI / 360))) * EARTH_RADIUS,
  }
}

export { EARTH_RADIUS, EARTH_CIRCUMFERENCE, MAX_LATITUDE, MAX_GRID_ZOOM }

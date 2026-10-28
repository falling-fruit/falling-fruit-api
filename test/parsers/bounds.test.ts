import test from 'node:test'
import assert from 'node:assert/strict'

import { parse_bounds } from '../../src/parsers/bounds'

test('parses a valid bounds string into two WGS84 points', () => {
  const points = parse_bounds('10,20|30,40')
  assert.deepEqual(points, [
    { x: 20, y: 10 },
    { x: 40, y: 30 }
  ])
})

test('throws when not exactly two points are given', () => {
  assert.throws(
    () => parse_bounds('10,20'),
    /Bounds not in the format \{lat\},\{lng\}\|\{lat\},\{lng\}/
  )
})

test('throws when the southwest latitude exceeds the northeast latitude', () => {
  assert.throws(
    () => parse_bounds('30,20|10,40'),
    /Bounds not in the format \{swlat\},\{swlng\}\|\{nelat\},\{nelng\}/
  )
})

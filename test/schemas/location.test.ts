import test from 'node:test'
import assert from 'node:assert/strict'

import { AddLocation, PatchLocation } from '../../src/schemas/schemas'

const baseBody = { lat: -26.8361046, type_ids: [1] }

test('normalizes a wrapped Australian longitude on submit (AddLocation)', () => {
  const result = AddLocation.safeParse({ ...baseBody, lng: -207.0386347 })
  assert.equal(result.success, true)
  assert.ok(Math.abs(result.data.lng - 152.9613653) < 1e-9)
})

test('normalizes a wrapped longitude on edit (PatchLocation)', () => {
  const result = PatchLocation.safeParse({ ...baseBody, lng: -207.0386347 })
  assert.equal(result.success, true)
  if (!result.success) return
  assert.ok(result.data.lng !== undefined)
  assert.ok(Math.abs(result.data.lng - 152.9613653) < 1e-9)
})

test('leaves an in-range longitude unchanged', () => {
  const result = AddLocation.safeParse({ ...baseBody, lng: 152.9613653 })
  assert.equal(result.success, true)
  assert.ok(Math.abs(result.data.lng - 152.9613653) < 1e-9)
})

test('normalizes a longitude wrapped the other way', () => {
  const result = AddLocation.safeParse({ ...baseBody, lng: 207.0386347 })
  assert.equal(result.success, true)
  assert.ok(Math.abs(result.data.lng - -152.9613653) < 1e-9)
})

test('rejects a non-numeric longitude', () => {
  const result = AddLocation.safeParse({ ...baseBody, lng: 'nope' })
  assert.equal(result.success, false)
})

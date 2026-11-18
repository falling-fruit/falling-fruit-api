import test from 'node:test'
import assert from 'node:assert/strict'

import { isAdmin, ownsOrAdmin, type User } from '../src/auth'

const user = (id: number, roles: string[]): User => ({
  id,
  roles,
  exp: 0,
  jti: 'jti',
})

test('isAdmin is true only for an authenticated user with the admin role', () => {
  assert.equal(isAdmin(user(1, ['user', 'admin'])), true)
  assert.equal(isAdmin(user(1, ['admin'])), true)
  assert.equal(isAdmin(user(1, ['user'])), false)
  assert.equal(isAdmin(user(1, [])), false)
  assert.equal(isAdmin(null), false)
})

test('ownsOrAdmin is true for the owner', () => {
  assert.equal(ownsOrAdmin(user(1, ['user']), 1), true)
})

test('ownsOrAdmin is true for an admin who is not the owner', () => {
  assert.equal(ownsOrAdmin(user(2, ['user', 'admin']), 1), true)
})

test('ownsOrAdmin is false for a non-owner non-admin', () => {
  assert.equal(ownsOrAdmin(user(2, ['user']), 1), false)
})

test('ownsOrAdmin is false for a non-admin when the resource has no owner', () => {
  assert.equal(ownsOrAdmin(user(1, ['user']), null), false)
})

test('ownsOrAdmin is true for an admin when the resource has no owner', () => {
  assert.equal(ownsOrAdmin(user(1, ['user', 'admin']), null), true)
})

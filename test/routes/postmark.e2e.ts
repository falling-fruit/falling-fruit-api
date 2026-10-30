import test from 'node:test'
import assert from 'node:assert/strict'

import setupE2E from '../e2eSetup'

const setup = setupE2E({ tables: ['users', 'refresh_tokens'] })

async function announcements(email: string): Promise<boolean | null> {
  const row = await setup.db.one<{ announcements_email: boolean | null }>(
    'SELECT announcements_email FROM users WHERE email = ${email}',
    { email },
  )
  return row.announcements_email
}

test('POST /postmark/subscription unsubscribes a recipient', async () => {
  const user = await setup.createUser({ email: 'subscriber@example.com' })

  const result = await setup.request('/postmark/subscription', {
    method: 'POST',
    body: {
      RecordType: 'SubscriptionChange',
      SuppressSending: true,
      Recipient: user.email,
    },
  })

  assert.equal(result.status, 200)
  assert.deepEqual(result.body, { message: 'Unsubscribe successful' })
  assert.equal(await announcements(user.email), false)
})

test('POST /postmark/subscription resubscribes a recipient', async () => {
  const user = await setup.createUser({ email: 'subscriber@example.com' })
  await setup.db.none(
    'UPDATE users SET announcements_email = false WHERE email = ${email}',
    { email: user.email },
  )

  const result = await setup.request('/postmark/subscription', {
    method: 'POST',
    body: {
      RecordType: 'SubscriptionChange',
      SuppressSending: false,
      Recipient: user.email,
    },
  })

  assert.equal(result.status, 200)
  assert.deepEqual(result.body, { message: 'Subscribe successful' })
  assert.equal(await announcements(user.email), true)
})

import test from 'node:test'
import assert from 'node:assert/strict'

import Mailer from '../../src/mail/mailer'
import type { EmailClient, EmailMessage } from '../../src/mail/email_client'
import type { Location } from '../../src/schemas/schemas'

const WEB_ORIGIN = 'https://example.org'

function makeMailer() {
  const sent: EmailMessage[] = []
  const client: EmailClient = {
    sendEmail(message) {
      sent.push(message)
      return Promise.resolve()
    },
  }
  const mailer = new Mailer({ client, webOrigin: WEB_ORIGIN })
  return { mailer, sent }
}

test('email confirmation includes the recipient, token, and web origin', () => {
  const { mailer, sent } = makeMailer()
  mailer.send_email_confirmation(
    { email: 'forager@example.com', name: 'Forager' },
    'abc123token',
  )
  assert.equal(sent.length, 1)
  const [email] = sent
  assert.equal(email.To, 'forager@example.com')
  assert.ok(email.Subject.length > 0)
  assert.match(email.HtmlBody, /abc123token/)
  assert.match(email.HtmlBody, /example\.org/)
  assert.equal(email.Tag, 'email-confirmation')
})

test('password reset includes the token and a link', () => {
  const { mailer, sent } = makeMailer()
  mailer.send_password_reset(
    { email: 'forager@example.com', name: 'Forager' },
    'reset-xyz',
  )
  const [email] = sent
  assert.match(email.HtmlBody, /reset-xyz/)
  assert.match(email.HtmlBody, /<a /)
  assert.equal(email.Tag, 'password-reset')
})

test('not-found emails mention the attempted email address', () => {
  const { mailer, sent } = makeMailer()
  mailer.send_password_reset_not_found({ email: 'unknown@example.com' })
  const [email] = sent
  assert.match(email.HtmlBody, /unknown@example\.com/)
})

test('report resolution for a single live location links the location id', () => {
  const { mailer, sent } = makeMailer()
  mailer.send_report_resolution({
    recipient: { email: 'forager@example.com', name: 'Forager' },
    resolution: { code: 2, response: 'Thanks for the heads up.' },
    responder: { name: 'Admin Ada' },
    reports: [{ id: 1, problem_code: 1, comment: null }],
    reportLocations: new Map([[1, { id: 123 }]]),
  })
  const [email] = sent
  assert.match(email.Subject, /#123/)
  assert.match(email.HtmlBody, /locations\/123/)
  assert.match(email.HtmlBody, /Thanks for the heads up\./)
  assert.match(email.HtmlBody, /Admin Ada/)
  assert.equal(email.Tag, 'problem-response')
})

test('report resolution greets a recipient without a name by email and signs with the responder', () => {
  const { mailer, sent } = makeMailer()
  mailer.send_report_resolution({
    recipient: { email: 'forager@example.com' },
    resolution: { code: 0, response: null },
    responder: { name: 'admin@example.com' },
    reports: [{ id: 1, problem_code: 0, comment: null }],
    reportLocations: new Map([[1, { id: 5 }]]),
  })
  const [email] = sent
  assert.match(email.HtmlBody, /Hello forager@example\.com,/)
  assert.match(email.HtmlBody, /admin@example\.com/)
})

test('report resolution for multiple locations lists each and uses a batch subject', () => {
  const { mailer, sent } = makeMailer()
  mailer.send_report_resolution({
    recipient: { email: 'forager@example.com', name: 'Forager' },
    resolution: { code: 2, response: null },
    responder: { name: 'Admin Ada' },
    reports: [
      { id: 1, problem_code: 1, comment: null },
      { id: 2, problem_code: 2, comment: 'duplicate of another' },
    ],
    reportLocations: new Map([
      [1, { id: 11 }],
      [2, { id: 22 }],
    ]),
  })
  const [email] = sent
  assert.match(email.Subject, /#11/)
  assert.match(email.Subject, /#22/)
  assert.match(email.HtmlBody, /<ul>/)
  assert.match(email.HtmlBody, /duplicate of another/)
})

test('report resolution describes a deleted location by address/coords instead of its unresolvable id', () => {
  const { mailer, sent } = makeMailer()
  mailer.send_report_resolution({
    recipient: { email: 'forager@example.com', name: 'Forager' },
    resolution: { code: 2, response: null },
    responder: { name: 'Admin Ada' },
    reports: [{ id: 1, problem_code: 1, comment: null }],
    reportLocations: new Map([
      [1, { deleted: { lat: 1.2, lng: 3.4, address: '123 Main St' } as Location }],
    ]),
  })
  const [email] = sent
  assert.match(email.Subject, /problem report/)
  assert.doesNotMatch(
    email.HtmlBody,
    /locations\/123/,
    'deleted locations must not be linked by their non-resolving id',
  )
  assert.match(email.HtmlBody, /at 1\.2, 3\.4 \(123 Main St\)/)
})

test('report resolution leaves the location unmentioned when neither id nor description is known', () => {
  const { mailer, sent } = makeMailer()
  mailer.send_report_resolution({
    recipient: { email: 'forager@example.com', name: 'Forager' },
    resolution: { code: 0, response: null },
    responder: { name: 'Admin Ada' },
    reports: [{ id: 1, problem_code: 1, comment: null }],
    reportLocations: new Map(),
  })
  const [email] = sent
  assert.match(email.Subject, /problem report/)
  assert.doesNotMatch(email.HtmlBody, /for location/)
})

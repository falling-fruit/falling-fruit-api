/** Minimal email client contract (satisfied by Postmark's ServerClient). */
type EmailClient = {
  sendEmail(message: {
    From: string
    To: string
    Subject: string
    HtmlBody: string
    MessageStream: string
    Tag: string | null
  }): unknown
}

/** User fields referenced when composing emails. */
type MailUser = {
  email: string
  name?: string | null
}

function createMailer({ client }: { client: EmailClient }) {
  const mailer: {
    send_email_confirmation: (user: MailUser, token: string) => unknown
    send_email_confirmation_exists: (user: MailUser) => unknown
    send_email_confirmation_not_found: (user: MailUser) => unknown
    send_email_confirmation_confirmed: (user: MailUser) => unknown
    send_password_reset: (user: MailUser, token: string) => unknown
    send_password_reset_not_found: (user: MailUser) => unknown
  } = {} as any

  function send_email({
    to,
    subject,
    body,
    tag = null,
  }: {
    to: string
    subject: string
    body: string
    tag?: string | null
  }) {
    return client.sendEmail({
      From: 'info@fallingfruit.org',
      To: to,
      Subject: subject,
      HtmlBody: body.replace(/\s{2,}/g, ''),
      MessageStream: 'outbound',
      Tag: tag,
    })
  }
  mailer.send_email_confirmation = function (user, token) {
  const email = {
    to: user.email,
    // Phrase: devise.mailer.confirmation_instructions.subject
    subject: 'Confirmation instructions',
    // Phrase: users.mailer.confirmation_instructions_html
    body: `
      <p>Welcome to Falling Fruit,</p>
      <p>To activate your account, you must confirm your email (${user.email}) by clicking the link below:<br/>
      <a href="${process.env.WEB_ORIGIN}/auth/confirmation?token=${token}">Confirm your email</a>
      </p>
      <p>Falling Fruit is powered by its users, so if you have the opportunity to add or improve it, please do so. Happy foraging!</p>
      <hr/>
      <p style="color: #666;">If you're having trouble clicking the link above, copy and paste this URL into your browser:<br/>${process.env.WEB_ORIGIN}/auth/confirmation?token=${token}
      </p>
    `,
    tag: 'email-confirmation'
  }
  return send_email(email)
}

mailer.send_email_confirmation_exists = function (user) {
  const email = {
    to: user.email,
    subject: 'Registration attempt',
    body: `
      <p>Hello ${user.name || user.email},</p>
      <p>Someone (possibly you) tried to sign up using this email (${user.email}). You already have an account, so you can sign in here instead:<br/>
      ${process.env.WEB_ORIGIN}/auth/sign_in
      </p>
      <p>If you forgot your password, reset it here:<br/>
      ${process.env.WEB_ORIGIN}/auth/password/new
      </p>
      <hr/>
      <p style="color: #666;">If you didn't request this, you can safely ignore this email or reply with any questions.</p>
    `,
    tag: 'email-confirmation'
  }
  return send_email(email)
}

mailer.send_email_confirmation_not_found = function (user) {
  const email = {
    to: user.email,
    subject: 'Email confirmation attempt',
    body: `
      <p>Hello,</p>
      <p>Someone (possibly you) requested a link to confirm a Falling Fruit account. However, no account is associated with this email (${user.email}). If you made this request, please try again using a different email address:<br/>
      ${process.env.WEB_ORIGIN}/auth/confirmation/new
      </p>
      <hr/>
      <p style="color: #666;">If you didn't request this, you can safely ignore this email or reply with any questions.</p>
    `,
    tag: 'email-confirmation'
  }
  return send_email(email)
}

mailer.send_email_confirmation_confirmed = function (user) {
  const email = {
    to: user.email,
    subject: 'Email already confirmed',
    body: `
      <p>Hello ${user.name || user.email},</p>
      <p>Someone (most likely you) requested a link to confirm your email (${user.email}). Your email is already confirmed, so you can simply sign in here:<br/>
      ${process.env.WEB_ORIGIN}/auth/sign_in
      </p>
      <hr/>
      <p style="color: #666;">If you didn't request this, you can safely ignore this email or reply with any questions.</p>
    `,
    tag: 'email-confirmation'
  }
  return send_email(email)
}

mailer.send_password_reset = function (user, token) {
  const email = {
    to: user.email,
    // Phrase: devise.mailer.reset_password_instructions.subject
    subject: 'Reset password instructions',
    // Phrase: users.mailer.reset_password_instructions_html
    body: `
      <p>Hello ${user.name || user.email},</p>
      <p>Someone (most likely you) requested a link to change your password:<br/>
      <a href="${process.env.WEB_ORIGIN}/auth/password/edit?token=${token}">Change your password</a>
      </p>
      <hr/>
      <p style="color: #666;">If you're having trouble clicking the link above, copy and paste this URL into your browser:<br/>
      ${process.env.WEB_ORIGIN}/auth/password/edit?token=${token}
      </p>
      <p style="color: #666;">If you didn't request this, you can safely ignore this email. Your password won't change unless you visit the link above and create a new one.</p>
    `,
    tag: 'password-reset'
  }
  return send_email(email)
}

mailer.send_password_reset_not_found = function (user) {
  const email = {
    to: user.email,
    subject: 'Password reset attempt',
    body: `
      <p>Hello,</p>
      <p>Someone (possibly you) requested a link to change the password for a Falling Fruit account. However, no account is associated with this email (${user.email}). If you made this request, please try again using a different email address:<br/>
      ${process.env.WEB_ORIGIN}/auth/password/new
      </p>
      <hr/>
      <p style="color: #666;">If you didn't request this, you can safely ignore this email or reply with any questions.</p>
    `,
    tag: 'password-reset'
  }
  return send_email(email)
}

  return mailer
}

export default createMailer

import type { EmailClient } from './email_client'
import EmailBody from './EmailBody'
import type { MailUser } from './EmailBody'
import {
  buildReportResolutionEmail,
  type ReportResolutionEmail,
} from './reportResolutionEmail'

class Mailer {
  private readonly email_client: EmailClient
  private readonly webOrigin: string

  constructor({
    client,
    webOrigin,
  }: {
    client: EmailClient
    webOrigin: string
  }) {
    this.email_client = client
    this.webOrigin = webOrigin
  }

  private send_email({
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
    return this.email_client.sendEmail({
      From: 'info@fallingfruit.org',
      To: to,
      Subject: subject,
      HtmlBody: body.replace(/\s{2,}/g, ''),
      MessageStream: 'outbound',
      Tag: tag,
    })
  }

  send_email_confirmation(user: MailUser, token: string) {
    const url = `${this.webOrigin}/auth/confirmation?token=${token}`
    const body = new EmailBody()
    // Phrase: users.mailer.confirmation_instructions_html
    body.appendParagraph('Welcome to Falling Fruit,')
    body.appendParagraph(
      `To activate your account, you must confirm your email (${user.email}) by clicking the link below:<br/>` +
        `<a href="${url}">Confirm your email</a>`,
    )
    body.appendParagraph(
      'Falling Fruit is powered by its users, so if you have the opportunity to add or improve it, please do so. Happy foraging!',
    )
    body.appendRule()
    body.appendMutedParagraph(
      `If you're having trouble clicking the link above, copy and paste this URL into your browser:<br/>${url}`,
    )
    return this.send_email({
      to: user.email,
      // Phrase: devise.mailer.confirmation_instructions.subject
      subject: 'Confirmation instructions',
      body: body.build(),
      tag: 'email-confirmation',
    })
  }

  send_email_confirmation_exists(user: MailUser) {
    const body = new EmailBody()
    body.appendGreeting(user)
    body.appendParagraph(
      `Someone (possibly you) tried to sign up using this email (${user.email}). You already have an account, so you can sign in here instead:<br/>` +
        `${this.webOrigin}/auth/sign_in`,
    )
    body.appendParagraph(
      `If you forgot your password, reset it here:<br/>${this.webOrigin}/auth/password/new`,
    )
    body.appendRule()
    body.appendMutedParagraph(
      "If you didn't request this, you can safely ignore this email or reply with any questions.",
    )
    return this.send_email({
      to: user.email,
      subject: 'Registration attempt',
      body: body.build(),
      tag: 'email-confirmation',
    })
  }

  send_email_confirmation_not_found(user: MailUser) {
    const body = new EmailBody()
    body.appendGreeting()
    body.appendParagraph(
      `Someone (possibly you) requested a link to confirm a Falling Fruit account. However, no account is associated with this email (${user.email}). If you made this request, please try again using a different email address:<br/>` +
        `${this.webOrigin}/auth/confirmation/new`,
    )
    body.appendRule()
    body.appendMutedParagraph(
      "If you didn't request this, you can safely ignore this email or reply with any questions.",
    )
    return this.send_email({
      to: user.email,
      subject: 'Email confirmation attempt',
      body: body.build(),
      tag: 'email-confirmation',
    })
  }

  send_email_confirmation_confirmed(user: MailUser) {
    const body = new EmailBody()
    body.appendGreeting(user)
    body.appendParagraph(
      `Someone (most likely you) requested a link to confirm your email (${user.email}). Your email is already confirmed, so you can simply sign in here:<br/>` +
        `${this.webOrigin}/auth/sign_in`,
    )
    body.appendRule()
    body.appendMutedParagraph(
      "If you didn't request this, you can safely ignore this email or reply with any questions.",
    )
    return this.send_email({
      to: user.email,
      subject: 'Email already confirmed',
      body: body.build(),
      tag: 'email-confirmation',
    })
  }

  send_password_reset(user: MailUser, token: string) {
    const url = `${this.webOrigin}/auth/password/edit?token=${token}`
    const body = new EmailBody()
    // Phrase: users.mailer.reset_password_instructions_html
    body.appendGreeting(user)
    body.appendParagraph(
      `Someone (most likely you) requested a link to change your password:<br/>` +
        `<a href="${url}">Change your password</a>`,
    )
    body.appendRule()
    body.appendMutedParagraph(
      `If you're having trouble clicking the link above, copy and paste this URL into your browser:<br/>${url}`,
    )
    body.appendMutedParagraph(
      "If you didn't request this, you can safely ignore this email. Your password won't change unless you visit the link above and create a new one.",
    )
    return this.send_email({
      to: user.email,
      // Phrase: devise.mailer.reset_password_instructions.subject
      subject: 'Reset password instructions',
      body: body.build(),
      tag: 'password-reset',
    })
  }

  send_password_reset_not_found(user: MailUser) {
    const body = new EmailBody()
    body.appendGreeting()
    body.appendParagraph(
      `Someone (possibly you) requested a link to change the password for a Falling Fruit account. However, no account is associated with this email (${user.email}). If you made this request, please try again using a different email address:<br/>` +
        `${this.webOrigin}/auth/password/new`,
    )
    body.appendRule()
    body.appendMutedParagraph(
      "If you didn't request this, you can safely ignore this email or reply with any questions.",
    )
    return this.send_email({
      to: user.email,
      subject: 'Password reset attempt',
      body: body.build(),
      tag: 'password-reset',
    })
  }

  send_report_resolution(params: ReportResolutionEmail) {
    const { subject, body } = buildReportResolutionEmail(
      this.webOrigin,
      params,
    )
    return this.send_email({
      to: params.recipient.email,
      subject,
      body,
      tag: 'problem-response',
    })
  }
}

export default Mailer

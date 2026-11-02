import postmark from 'postmark'
import type { Config } from '../config'

/** Minimal email client contract (satisfied by Postmark's ServerClient). */
export type EmailClient = {
  sendEmail(message: {
    From: string
    To: string
    Subject: string
    HtmlBody: string
    MessageStream: string
    Tag: string | null
  }): unknown
}

function createLoggingEmailClient(): EmailClient {
  return {
    sendEmail({ To, Subject, Tag, HtmlBody }) {
      console.log(
        `[email disabled] To: ${To} | Subject: ${Subject} | Tag: ${Tag}\n` +
          HtmlBody,
      )
      return Promise.resolve()
    },
  }
}

export function createEmailClient(config: Config): EmailClient {
  if (!config.postmark) {
    return createLoggingEmailClient()
  }
  // The SDK client is stricter about null vs undefined than the app's minimal
  // contract, so it is adapted to the contract at this boundary.
  return new postmark.ServerClient(config.postmark.apiToken) as EmailClient
}

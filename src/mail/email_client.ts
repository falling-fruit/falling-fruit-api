import postmark from 'postmark'
import type { Config } from '../config'

export type EmailMessage = {
  From: string
  To: string
  Subject: string
  HtmlBody: string
  MessageStream: string
  Tag: string | null
}

export type EmailClient = {
  sendEmail(message: EmailMessage): unknown
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
  return new postmark.ServerClient(config.postmark.apiToken) as EmailClient
}

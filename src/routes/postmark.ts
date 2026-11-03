import makeRouter from './makeRouter'
import type { Services } from './services'

/**
 * Subscription-change webhook payload from Postmark.
 * https://postmarkapp.com/developer/webhooks/subscription-change-webhook
 */
type PostmarkSubscriptionChange = {
  ServerID?: number
  MessageStream?: string
  RecordType?: string
  SuppressSending?: boolean
  Recipient?: string
}

export default function ({
  db,
  middleware,
  auth,
  postmarkServerId,
  postmarkBroadcastStream,
}: Services) {
  const { router, post } = makeRouter()

  // Mailing list subscription (via Postmark)
  // https://postmarkapp.com/developer/webhooks/subscription-change-webhook
  post(
    '/postmark/subscription',
    auth.none,
    middleware.authenticate_postmark,
    async (req) => {
      const body = req.body as PostmarkSubscriptionChange
      if (
        body.ServerID !== postmarkServerId ||
        body.MessageStream !== postmarkBroadcastStream ||
        body.RecordType !== 'SubscriptionChange' ||
        typeof body.SuppressSending !== 'boolean' ||
        typeof body.Recipient !== 'string'
      ) {
        throw Error(
          `Unexpected request from Postmark: ${JSON.stringify(req.body)}`,
        )
      }
      if (body.SuppressSending) {
        await db.users.unsubscribe(body.Recipient)
        return { message: 'Unsubscribe successful' }
      } else {
        await db.users.subscribe(body.Recipient)
        return { message: 'Subscribe successful' }
      }
    },
  )

  return router
}

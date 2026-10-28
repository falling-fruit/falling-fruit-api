import makeRouter from './makeRouter'
import type { Services } from './services'

export = function ({
  db,
  middleware,
  postmarkServerId,
  postmarkBroadcastStream,
}: Services) {
  const { router, post } = makeRouter()

  // Mailing list subscription (via Postmark)
  // https://postmarkapp.com/developer/webhooks/subscription-change-webhook
  post(
    '/postmark/subscription',
    middleware.authenticate_postmark,
    async (req: any) => {
      if (
        req.body.ServerID !== postmarkServerId ||
        req.body.MessageStream !== postmarkBroadcastStream ||
        req.body.RecordType !== 'SubscriptionChange' ||
        typeof req.body.SuppressSending !== 'boolean'
      ) {
        throw Error(
          `Unexpected request from Postmark: ${JSON.stringify(req.body)}`,
        )
      }
      if (req.body.SuppressSending) {
        await db.users.unsubscribe(req.body.Recipient)
        return { message: 'Unsubscribe successful' }
      } else {
        await db.users.subscribe(req.body.Recipient)
        return { message: 'Subscribe successful' }
      }
    },
  )

  return router
}

const db = require('../db')
const middleware = require('../middleware')
const makeRouter = require('./makeRouter')

const { router, get, post, put, drop } = makeRouter()

// Mailing list subscription (via Postmark)
// https://postmarkapp.com/developer/webhooks/subscription-change-webhook

post(
  '/subscription',
  middleware.authenticate_postmark,
  async (req) => {
    if (
      req.body.ServerID !== parseInt(process.env.POSTMARK_SERVER_ID) ||
      req.body.MessageStream !== process.env.POSTMARK_BROADCAST_STREAM ||
      req.body.RecordType !== 'SubscriptionChange' ||
      typeof req.body.SuppressSending !== 'boolean'
    ) {
      throw Error(`Unexpected request from Postmark: ${JSON.stringify(req.body)}`)
    }
    if (req.body.SuppressSending) {
      await db.users.unsubscribe(req.body.Recipient)
      return {message: 'Unsubscribe successful'}
    } else {
      await db.users.subscribe(req.body.Recipient)
      return {message: 'Subscribe successful'}
    }
  }
)

module.exports = router

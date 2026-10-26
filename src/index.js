require('dotenv').config()
const path = require('path')
const postmark = require('postmark')
const aws = require('aws-sdk')
const makeDb = require('./db')
const Tokenizer = require('./tokens')
const makeMiddleware = require('./middleware')
const createMailer = require('./mailer')
const createPhotos = require('./photos')
const makeRoutes = require('./routes')
const express = require('express')
const cors = require('cors')
const compression = require('compression')

const logging_postmark_client = {
  sendEmail({To, Subject, Tag, HtmlBody}) {
    console.log(
      `[email disabled] To: ${To} | Subject: ${Subject} | Tag: ${Tag}\n` +
      HtmlBody
    )
    return Promise.resolve()
  }
}

const logging_s3 = {
  upload({Key}) {
    return {
      promise() {
        const base = (process.env.API_ORIGIN || '').replace(/\/+$/, '')
        const location = `${base}/uploads/${Key.split(path.sep).join('/')}`
        console.log(`[s3 disabled] upload Key: ${Key} -> ${location}`)
        return Promise.resolve({Location: location})
      }
    }
  },
  copyObject({CopySource, Key}) {
    return {
      promise() {
        console.log(`[s3 disabled] copyObject ${CopySource} -> ${Key}`)
        return Promise.resolve({})
      }
    }
  }
}

const postmark_client = process.env.POSTMARK_DISABLED
  ? logging_postmark_client
  : new postmark.ServerClient(process.env.POSTMARK_API_TOKEN)

const s3_client = process.env.S3_DISABLED
  ? logging_s3
  : new aws.S3({
      region: process.env.S3_REGION,
      accessKeyId: process.env.S3_ACCESS_KEY_ID,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
      apiVersion: '2006-03-01'
    })

const db = makeDb(process.env.DB, true)
const tokenizer = new Tokenizer()
const middleware = makeMiddleware({ db, tokenizer })
const mailer = createMailer({ client: postmark_client })
const photos = createPhotos({ s3: s3_client })
const routes = makeRoutes({ db, tokenizer, middleware, mailer, photos })

function is_object(x) {
  return (!!x) && (x.constructor === Object)
}

function null_empty_strings(obj) {
  if (!is_object(obj)) {
    return obj
  }
  const out = {}
  for (const [key, value] of Object.entries(obj)) {
    if (is_object(value)) {
      out[key] = null_empty_strings(value)
    } else {
      out[key] = value === "" ? null : value
    }
  }
  return out
}

// Configuration
const app = express()
app.use(compression())
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// CORS
// https://httptoolkit.tech/blog/cache-your-cors
// https://www.moesif.com/blog/technical/cors/Authoritative-Guide-to-CORS-Cross-Origin-Resource-Sharing-for-REST-APIs
app.use(cors({
  // Browser cache time for preflight responses (Access-Control-Max-Age)
  maxAge: 86400, // seconds
  // Allow us to manually add to preflights
  preflightContinue: true
}))

// Register default handlers
app.use((req, res, next) => {
  if (req.method === 'OPTIONS') {
    // Add cache-control to preflight responses
    res.setHeader('Cache-Control', 'public, max-age=86400');
    // Vary: origin set automatically
    return void res.end()
  }
  if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
    // Null empty strings in JSON body
    req.body = null_empty_strings(req.body)
  }
  return void next()
})

// Routes: Docs
app.use(
  `${process.env.API_BASE}/openapi.yml`,
  express.static('docs/openapi.yml')
)

// Pre-route middleware
app.use((req, res, next) => {
  const skip_api_key = [
    // OpenAPI OAuth2 password flow
    `${process.env.API_BASE}/user/token`,
    // Email confirmation link
    `${process.env.API_BASE}/user/confirmation`,
    // Postmark subscription webhook
    `${process.env.API_BASE}/postmark/subscription`,
  ]
  if (skip_api_key.includes(req.path)) {
    return next()
  }
  return middleware.check_api_key(req, res, next)
})

for (const [segment, router] of Object.entries(routes)) {
  app.use(`${process.env.API_BASE}/${segment}`, router)
}

// Start server
app.listen(process.env.PORT, () => {
    console.log(`Ready for requests on http://localhost:${process.env.PORT}`)
})

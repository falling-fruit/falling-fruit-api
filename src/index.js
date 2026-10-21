require('dotenv').config()
const middleware = require('./middleware')
const routes = require('./routes')
const express = require('express')
const cors = require('cors')
const compression = require('compression')

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

// Routes: Locally stored photos (only when S3 is disabled for local dev)
if (process.env.S3_DISABLED) {
  app.use('/uploads', express.static('uploads'))
}

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

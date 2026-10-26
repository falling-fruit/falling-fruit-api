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

function createApp({ middleware, routes, apiBase }) {
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
    `${apiBase}/openapi.yml`,
    express.static('docs/openapi.yml')
  )

  // Pre-route middleware
  app.use((req, res, next) => {
    const skip_api_key = [
      // OpenAPI OAuth2 password flow
      `${apiBase}/user/token`,
      // Email confirmation link
      `${apiBase}/user/confirmation`,
      // Postmark subscription webhook
      `${apiBase}/postmark/subscription`,
    ]
    if (skip_api_key.includes(req.path)) {
      return next()
    }
    return middleware.check_api_key(req, res, next)
  })

  for (const [segment, router] of Object.entries(routes)) {
    app.use(`${apiBase}/${segment}`, router)
  }

  return app
}

module.exports = createApp

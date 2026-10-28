import express from 'express'
import type { Router, RequestHandler } from 'express'
import cors from 'cors'
import compression from 'compression'
import type { Middleware } from './routes/services'
import makeRoutes = require('./routes')

type Routes = ReturnType<typeof makeRoutes>

type CreateAppOptions = {
  middleware: Middleware
  routes: Routes
  apiBase: string
}

function is_object(x: unknown): x is Record<string, unknown> {
  return !!x && (x as object).constructor === Object
}

function null_empty_strings(obj: unknown): unknown {
  if (!is_object(obj)) {
    return obj
  }
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(obj)) {
    if (is_object(value)) {
      out[key] = null_empty_strings(value)
    } else {
      out[key] = value === '' ? null : value
    }
  }
  return out
}

function createApp({ middleware, routes, apiBase }: CreateAppOptions) {
  const app = express()
  app.use(compression())
  app.use(express.json())
  app.use(express.urlencoded({ extended: true }))

  // CORS
  // https://httptoolkit.tech/blog/cache-your-cors
  // https://www.moesif.com/blog/technical/cors/Authoritative-Guide-to-CORS-Cross-Origin-Resource-Sharing-for-REST-APIs
  app.use(
    cors({
      // Browser cache time for preflight responses (Access-Control-Max-Age)
      maxAge: 86400, // seconds
      // Allow us to manually add to preflights
      preflightContinue: true,
    }),
  )

  // Register default handlers
  const defaultHandler: RequestHandler = (req, res, next) => {
    if (req.method === 'OPTIONS') {
      // Add cache-control to preflight responses
      res.setHeader('Cache-Control', 'public, max-age=86400')
      // Vary: origin set automatically
      return void res.end()
    }
    if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
      // Null empty strings in JSON body
      req.body = null_empty_strings(req.body)
    }
    return void next()
  }
  app.use(defaultHandler)

  // Routes: Docs
  app.use(`${apiBase}/openapi.yml`, express.static('docs/openapi.yml'))

  // Pre-route middleware
  const preRouteHandler: RequestHandler = (req, res, next) => {
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
  }
  app.use(preRouteHandler)

  for (const router of Object.values(routes) as Router[]) {
    app.use(apiBase, router)
  }

  return app
}

export = createApp

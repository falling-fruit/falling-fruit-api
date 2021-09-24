const db = require('./db')
const helpers = require('./helpers').default
const express = require('express')
const cors = require('cors')
const multer = require('multer')
const uploads = multer({ dest: 'uploads' })

// Constants
const PORT = 3300
const BASE = '/test-api/0.3'

// Configuration
const app = express()
app.use(cors())
app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(BASE, express.static('docs'))

// Routes: Clusters
get(`${BASE}/clusters`, req => db.clusters.list(req.query))

// Routes: Types
get(`${BASE}/types`, () => db.types.list())
get(`${BASE}/types/counts`, req => db.types.count(req.query))
get(`${BASE}/types/:id`, req => db.types.show(req.params.id))

// Routes: Locations
get(`${BASE}/locations`, req => db.locations.list(req.query))
post(`${BASE}/locations`, async req => {
  req.body.user_id = null
  if (req.query.token) {
    const user = await db.users.find_user_by_token(req.query.token)
    if (!user.add_anonymously) {
      // Link location to logged-in user
      req.body.user_id = user.id
    }
  }
  return db.locations.add(req.body)
})
get(`${BASE}/locations/random`, req => db.locations.random())
get(`${BASE}/locations/count`, req => db.locations.count(req.query))
get(`${BASE}/locations/:id`, req => db.locations.show(req.params.id))
put(`${BASE}/locations/:id`, req => db.locations.edit(req.params.id, req.body))

// Routes: Reviews
get(`${BASE}/locations/:id/reviews`, req => db.reviews.list(req.params.id))
post(`${BASE}/locations/:id/reviews`, async req => {
  const obj = JSON.parse(req.body.json)
  obj.user_id = null
  if (req.query.token) {
    const user = await db.users.find_user_by_token(req.query.token)
    if (!user.add_anonymously) {
      // Link review to logged-in user
      obj.user_id = user.id
    }
  }
  return db.reviews.add(req.params.id, obj)
}, uploads.array('photo'))
get(`${BASE}/reviews/:id`, req => db.reviews.show(req.params.id))
put(`${BASE}/reviews/:id`, async req => {
  // Restrict to linked user
  const user = await db.users.find_user_by_token(req.query.token)
  const review = await db.reviews.show(req.params.id)
  if (user.id != review.user_id) {
    throw Error('Not authorized')
  }
  return db.reviews.edit(req.params.id, JSON.parse(req.body.json))
}, uploads.array('photo'))

// Routes: Users
post(`${BASE}/users`, req => db.users.add(req))
get(`${BASE}/users/token`, req => db.users.get_token(req.query))
put(`${BASE}/users/:id`, req => db.users.edit(req))

// Routes: Reports
post(`${BASE}/reports`, async req => {
  if (req.query.token) {
    const user = await db.users.find_user_by_token(req.query.token)
    req.body.reporter_id = user.id
    req.body.email = req.body.email || user.email
    req.body.name = req.body.name || user.name
  } else {
    req.body.reporter_id = null
  }
  return db.reports.add(req.body)
})

// Routes: Tiles
app.get(`${BASE}/tiles/:z/:x/:y.pbf`, async (req, res) => {
  try {
    await check_key(req)
    const data = await db.tiles.show(req.params)
    res.status(200).end(data)
  } catch (error) {
    res.status(400).json({
      error: error.message || error
    })
  }
})

// Generic handlers
function get(url, handler) {
  app.get(url, async (req, res) => {
    try {
      await check_key(req)
      const data = await handler(req)
      res.status(200).json(data)
    } catch (error) {
      res.status(400).json({
        error: error.message || error
      })
    }
  })
}

function post(url, handler, uploader) {
  uploader = uploader || uploads.none()
  app.post(url, uploader, async (req, res) => {
    try {
      await check_key(req)
      const data = await handler(req)
      res.status(200).json(data)
    } catch (error) {
      res.status(400).json({
        error: error.message || error
      })
    }
  })
}

function put(url, handler, uploader) {
  uploader = uploader || uploads.none()
  app.put(url, uploader, async (req, res) => {
    try {
      await check_key(req)
      const data = await handler(req)
      res.status(200).json(data)
    } catch (error) {
      res.status(400).json({
        error: error.message || error
      })
    }
  })
}

async function check_key(req) {
  const keys = await db.any("SELECT id FROM api_keys WHERE api_key=${key}", req.query)
  if (keys.length == 0) {
    throw Error('key is invalid')
  }
}

// Start server
app.listen(PORT, () => {
    console.log('Ready for requests on http://localhost:' + PORT)
})

const db = require('./db')
const helpers = require('./helpers').default
const express = require('express')
const cors = require('cors')
const multer = require('multer')
const uploader = multer({ dest: 'uploads' })

// Constants
const PORT = 3300
const BASE = '/test-api/0.3'

// Configuration
const app = express()
app.use(cors())
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Routes
get(`${BASE}/clusters`, req => db.clusters.list(req.query))
get(`${BASE}/types`, () => db.types.list())
get(`${BASE}/types/:id`, req => db.types.show(req.params.id))
get(`${BASE}/types/counts`, req => db.types.count(req.query))
get(`${BASE}/locations`, req => db.locations.list(req.query))
post(`${BASE}/locations`, uploader.none(), req => db.locations.add(req))
get(`${BASE}/locations/:id`, req => db.locations.show(req.params.id))
put(`${BASE}/locations/:id`, uploader.none(), req => db.locations.edit(req))
get(`${BASE}/locations/:id/reviews`, req => db.reviews.list(req.params.id))
post(`${BASE}/locations/:id/reviews`, uploader.array('photo'), req => db.reviews.add(req))
put(`${BASE}/locations/:id/reviews/:rid`, uploader.array('photo'), req => db.reviews.edit(req))
get(`${BASE}/locations/count`, req => db.locations.count(req.query))

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

function post(url, uploader, handler) {
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

function put(url, uploader, handler) {
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

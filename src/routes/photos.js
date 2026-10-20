const db = require('../db')
const _ = require('../helpers')
const middleware = require('../middleware')
const multer = require('multer')
const uploads = multer({ dest: 'uploads' })
const makeRouter = require('./makeRouter')

const { router, get, post, put, drop } = makeRouter()

post(
  '/',
  middleware.authenticate(),
  // middleware.recaptcha,
  uploads.single('file'),
  async req => {
    const urls = await _.resize_and_upload_photo(req.file.path)
    return db.photos.add(urls, req.user ? req.user.id : null)
  }
)

module.exports = router

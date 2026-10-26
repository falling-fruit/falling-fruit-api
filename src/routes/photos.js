const multer = require('multer')
const uploads = multer({ dest: 'uploads' })
const makeRouter = require('./makeRouter')

module.exports = function({ db, middleware, photos }) {
  const { router, get, post, put, drop } = makeRouter()

post(
  '/',
  middleware.authenticate(),
  // middleware.recaptcha,
  uploads.single('file'),
  async req => {
    const urls = await photos.resize_and_upload_photo(req.file.path)
    return db.photos.add(urls, req.user ? req.user.id : null)
  }
)

  return router
}

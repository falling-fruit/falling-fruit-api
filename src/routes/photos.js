const multer = require('multer')
const uploads = multer({ dest: 'uploads' })
const makeRouter = require('./makeRouter')

module.exports = function({ db, middleware, photos }) {
  const { router, get, post, put, drop } = makeRouter()

/**
 * @openapi
 * /photos:
 *   post:
 *     tags:
 *       - Photos
 *     summary: Upload a photo.
 *     security:
 *       - key: []
 *       - key: []
 *         token: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - file
 *             properties:
 *               file:
 *                 description: File to upload (jpeg, png, webp, gif, or svg). Images are converted to jpeg and resized as needed to a maximum dimension of 2048 pixels.
 *                 type: string
 *                 minLength: 1
 *                 format: binary
 *                 nullable: false
 *     responses:
 *       '200':
 *         description: Success
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Photo'
 */
post(
  '/photos',
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

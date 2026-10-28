import multer from 'multer'
import makeRouter from './makeRouter'
import type { Services } from './services'
import { z } from '../schemas/registry'
import { Photo } from '../schemas/schemas'

const uploads = multer({ dest: 'uploads' })

const PhotoUploadBody = z.object({
  file: z.string().openapi({
    description:
      'File to upload (jpeg, png, webp, gif, or svg). Images are converted to jpeg and resized as needed to a maximum dimension of 2048 pixels.',
    format: 'binary',
    minLength: 1,
  }),
})

export = function ({ db, auth, photos }: Services) {
  const { router, post } = makeRouter()

  post(
    {
      path: '/photos',
      summary: 'Upload a photo.',
      tags: ['Photos'],
      security: [{ key: [] }, { key: [], token: [] }],
      request: {
        body: {
          schema: PhotoUploadBody,
          mediaType: 'multipart/form-data',
          required: true,
        },
      },
      responses: {
        '200': { description: 'Success', schema: Photo },
      },
    },
    auth.optional,
    // middleware.recaptcha,
    uploads.single('file'),
    async (req, user) => {
      const urls = await photos.resize_and_upload_photo(req.file.path)
      return db.photos.add(urls, user ? user.id : null)
    },
  )

  return router
}

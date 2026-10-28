import makeRouter from './makeRouter'
import type { Services } from './services'
import { EditReport, Report } from '../schemas/schemas'
import { recaptchaParam } from '../schemas/parameters'

export = function ({ db, middleware }: Services) {
  const { router, post } = makeRouter()

  post(
    {
      path: '/reports',
      summary: 'Create a Report.',
      tags: ['Reports'],
      security: [{ key: [] }, { key: [], token: [] }],
      request: {
        headers: [recaptchaParam],
        body: { schema: EditReport, required: true },
      },
      responses: {
        '200': { description: 'Success', schema: Report },
      },
    },
    middleware.authenticate(),
    middleware.recaptcha,
    async (req: any) => {
      if (req.user) {
        req.body.reporter_id = req.user.id
        if (!req.body.email || !req.body.name) {
          const user = await db.one(
            'SELECT name, email FROM users WHERE id=${id}',
            { id: req.user.id },
          )
          req.body.email = req.body.email || user.email
          req.body.name = req.body.name || user.name
        }
      }
      if (!req.body.email) {
        throw Error('An email is required')
      }
      if (req.body.problem_code === 5 && !req.body.comment) {
        throw Error('comment is required when problem_code = 5')
      }
      return db.reports.add(req.body)
    },
  )

  return router
}

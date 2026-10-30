import makeRouter from './makeRouter'
import type { Services } from './services'
import { EditReport, Report } from '../schemas/schemas'
import { recaptchaParam } from '../schemas/parameters'

export default function ({ db, middleware, auth }: Services) {
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
    auth.optional,
    middleware.recaptcha,
    async (req, user) => {
      const report: typeof req.body & { reporter_id?: number } = {
        ...req.body,
      }
      if (user) {
        report.reporter_id = user.id
        if (!report.email || !report.name) {
          const dbUser = await db.one<{ name: string | null; email: string }>(
            'SELECT name, email FROM users WHERE id=${id}',
            { id: user.id },
          )
          report.email = report.email || dbUser.email
          report.name = report.name || dbUser.name
        }
      }
      if (!report.email) {
        throw Error('An email is required')
      }
      if (report.problem_code === 5 && !report.comment) {
        throw Error('comment is required when problem_code = 5')
      }
      return db.reports.add(report)
    },
  )

  return router
}

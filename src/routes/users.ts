import makeRouter from './makeRouter'
import type { Services } from './services'
import { z } from '../schemas/registry'
import { PublicUser } from '../schemas/schemas'
import { userIdParam } from '../schemas/parameters'

export = function ({ db }: Services) {
  const { router, get } = makeRouter()

  get(
    {
      path: '/users/:id',
      summary: 'View a user (public).',
      tags: ['Users'],
      security: [{ key: [] }],
      request: { params: z.object({ id: userIdParam }) },
      responses: {
        '200': { description: 'Success', schema: PublicUser },
      },
    },
    (req: any) => db.users.show_public(req.params.id),
  )

  return router
}

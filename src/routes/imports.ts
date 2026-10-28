import makeRouter from './makeRouter'
import type { Services } from './services'
import { z } from '../schemas/registry'
import { Import } from '../schemas/schemas'
import { importIdParam } from '../schemas/parameters'

export default function ({ db, auth }: Services) {
  const { router, get } = makeRouter()

  get(
    {
      path: '/imports',
      summary: 'Fetch Imports.',
      tags: ['Imports'],
      security: [{ key: [] }],
      responses: {
        '200': { description: 'Success', schema: z.array(Import) },
      },
    },
    auth.none,
    () => db.imports.list(),
  )

  get(
    {
      path: '/imports/:id',
      summary: 'Fetch Import.',
      tags: ['Imports'],
      security: [{ key: [] }],
      request: { params: z.object({ id: importIdParam }) },
      responses: {
        '200': { description: 'Success', schema: Import },
      },
    },
    auth.none,
    (req) => db.imports.show(req.params.id),
  )

  return router
}

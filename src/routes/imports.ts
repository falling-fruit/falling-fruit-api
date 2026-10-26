import makeRouter from './makeRouter'
import { z } from '../schemas/registry'
import { Import } from '../schemas/schemas'
import { importIdParam } from '../schemas/parameters'

export = function ({ db }: any) {
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
    (req: any) => db.imports.show(req.params.id),
  )

  return router
}

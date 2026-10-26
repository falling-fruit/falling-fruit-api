import makeRouter from './makeRouter'
import { z } from '../schemas/registry'
import { Type, TypeCount, SubmitType } from '../schemas/schemas'
import {
  boundsParam,
  muniParam,
  typeIdParam,
  recaptchaParam,
} from '../schemas/parameters'

const idParams = z.object({ id: z.coerce.number().int().min(1) })

export = function ({ db, middleware }: any) {
  const { router, get, post } = makeRouter()

  get(
    {
      path: '/types',
      summary: 'Fetch Types.',
      tags: ['Types'],
      security: [{ key: [] }],
      responses: {
        '200': { description: 'Success', schema: z.array(Type) },
      },
    },
    () => db.types.list(),
  )

  post(
    {
      path: '/types',
      summary: 'Submit new Type.',
      description: 'Only an admin can submit a type with `pending: false`.',
      tags: ['Types'],
      security: [{ key: [] }, { key: [], token: [] }],
      request: {
        headers: [recaptchaParam],
        body: { schema: SubmitType, required: true },
      },
      responses: {
        '200': { description: 'Success', schema: z.array(Type) },
      },
    },
    middleware.authenticate(),
    middleware.recaptcha,
    (req: any, res: any) => {
      if (
        req.body.pending === false &&
        (!req.user || !req.user.roles.includes('admin'))
      ) {
        return void res
          .status(403)
          .json({ error: 'Only admins can approve a type (pending: false)' })
      }
      const user_id = req.user ? req.user.id : null
      return db.types.add({ ...req.body, user_id })
    },
  )

  get(
    {
      path: '/types/counts',
      summary: 'Count Types.',
      tags: ['Types'],
      security: [{ key: [] }],
      request: {
        query: z.object({
          bounds: boundsParam,
          muni: muniParam,
          zoom: z.coerce.number().int().min(0).max(14).optional().openapi({
            description:
              'Zoom level, where the world is divided into a 2<sup>zoom</sup> x 2<sup>zoom</sup> grid. If provided, only counts the Types of Locations whose Cluster centerpoints at this zoom level fall within `bounds` (faster). Otherwise, a full count is performed using Location coordinates.',
            default: null,
          }),
        }),
      },
      responses: {
        '200': { description: 'Success', schema: z.array(TypeCount) },
      },
    },
    (req: any) => db.types.count(req.query),
  )

  get(
    {
      path: '/types/:id',
      summary: 'Fetch Type.',
      tags: ['Types'],
      security: [{ key: [] }],
      request: { params: z.object({ id: typeIdParam }) },
      responses: {
        '200': { description: 'Success', schema: Type },
      },
    },
    (req: any) => db.types.show(req.params.id),
  )

  return router
}

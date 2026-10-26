const makeRouter = require('./makeRouter')

module.exports = function({ db, middleware }) {
  const { router, get, post, put, drop } = makeRouter()

/**
 * @openapi
 * /types:
 *   get:
 *     summary: Fetch Types.
 *     tags:
 *       - Types
 *     security:
 *       - key: []
 *     responses:
 *       '200':
 *         description: Success
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Type'
 */
get(
  '/types',
  () => db.types.list()
)
/**
 * @openapi
 * /types:
 *   post:
 *     summary: Submit new Type.
 *     description: |-
 *       Only an admin can submit a type with `pending: false`.
 *     tags:
 *       - Types
 *     security:
 *       - key: []
 *       - key: []
 *         token: []
 *     parameters:
 *       - $ref: '#/components/parameters/recaptcha'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SubmitType'
 *     responses:
 *       '200':
 *         description: Success
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Type'
 */
post(
  '/types',
  middleware.authenticate(),
  middleware.recaptcha,
  (req, res) => {
    if (req.body.pending === false && (!req.user || !req.user.roles.includes('admin'))) {
      return void res.status(403).json(
        {error: 'Only admins can approve a type (pending: false)'}
      )
    }
    const user_id = req.user ? req.user.id : null
    return db.types.add({...req.body, user_id: user_id})
  }
)

/**
 * @openapi
 * /types/counts:
 *   get:
 *     summary: Count Types.
 *     tags:
 *       - Types
 *     security:
 *       - key: []
 *     parameters:
 *       - $ref: '#/components/parameters/bounds'
 *       - $ref: '#/components/parameters/muni'
 *       - name: zoom
 *         description: Zoom level, where the world is divided into a 2<sup>zoom</sup> x 2<sup>zoom</sup> grid. If provided, only counts the Types of Locations whose Cluster centerpoints at this zoom level fall within `bounds` (faster). Otherwise, a full count is performed using Location coordinates.
 *         in: query
 *         schema:
 *           type: integer
 *           minimum: 0
 *           maximum: 14
 *           default: null
 *     responses:
 *       '200':
 *         description: Success
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/TypeCount'
 */
get(
  '/types/counts',
  req => db.types.count(req.query)
)

/**
 * @openapi
 * /types/{id}:
 *   get:
 *     summary: Fetch Type.
 *     tags:
 *       - Types
 *     security:
 *       - key: []
 *     parameters:
 *       - $ref: '#/components/parameters/type_id'
 *     responses:
 *       '200':
 *         description: Success
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Type'
 */
get(
  '/types/:id',
  req => db.types.show(req.params.id)
)

  return router
}

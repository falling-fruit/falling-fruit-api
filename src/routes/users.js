const makeRouter = require('./makeRouter')

module.exports = function({ db }) {
  const { router, get, post, put, drop } = makeRouter()

/**
 * @openapi
 * /users/{id}:
 *   get:
 *     summary: View a user (public).
 *     tags:
 *       - Users
 *     security:
 *       - key: []
 *     parameters:
 *       - $ref: '#/components/parameters/user_id'
 *     responses:
 *       '200':
 *         description: Success
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PublicUser'
 */
get(
  '/users/:id',
  async (req) => {
    return await db.users.show_public(req.params.id)
  }
)

  return router
}

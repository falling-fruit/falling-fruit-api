import type { Request, RequestHandler } from 'express'
import AuthService from './AuthService'

/** The authenticated user attached to the request. */
export type User = { id: number; roles: string[]; exp: number; jti: string }

/** Whether the user is authenticated and has the admin role. */
export const isAdmin = (user: User | null): boolean =>
  !!user && user.roles.includes('admin')

/** Whether the user owns the resource (by owner id) or is an admin. */
export const ownsOrAdmin = (user: User, owner_id: number | null): boolean =>
  user.id === owner_id || isAdmin(user)

/** Request carrying the (optionally) authenticated user resolved by auth. */
export type AuthRequest = Request & { user?: User }

/** How a route resolves the authenticated user. */
export type AuthMode = 'required' | 'optional' | 'none'

/**
 * A typed authentication specification passed as the second argument to a
 * router method. The phantom `mode` determines the final handler signature:
 * - `required`: handler receives a guaranteed `User`.
 * - `optional`: handler receives `User | null`.
 * - `none`: handler receives no user argument.
 */
export interface AuthSpec<Mode extends AuthMode> {
  mode: Mode
  handlers: RequestHandler[]
}

/** The auth service: constructors of typed auth specs. */
export type Auth = AuthService

export { AuthService }
export default AuthService

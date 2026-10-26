import clusters from './clusters'
import types from './types'
import locations from './locations'
import tiles from './tiles'
import reviews from './reviews'
import photos from './photos'
import users from './users'
import user from './user'
import postmark from './postmark'
import reports from './reports'
import imports from './imports'

function makeRoutes(services: any) {
  return {
    clusters: clusters(services),
    types: types(services),
    locations: locations(services),
    tiles: tiles(services),
    reviews: reviews(services),
    photos: photos(services),
    users: users(services),
    user: user(services),
    postmark: postmark(services),
    reports: reports(services),
    imports: imports(services),
  }
}

export = makeRoutes

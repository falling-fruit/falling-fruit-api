function makeRoutes(services) {
  return {
    clusters: require('./clusters')(services),
    types: require('./types')(services),
    locations: require('./locations')(services),
    tiles: require('./tiles')(services),
    reviews: require('./reviews')(services),
    photos: require('./photos')(services),
    users: require('./users')(services),
    user: require('./user')(services),
    postmark: require('./postmark')(services),
    reports: require('./reports')(services),
    imports: require('./imports')(services)
  }
}

module.exports = makeRoutes

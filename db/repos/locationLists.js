const sql = require('../sql').locationLists

class LocationLists {
  constructor(db, pgp) {
    this.db = db
    this.pgp = pgp
  }

  addList(obj, user) {
    const values = {
      name: null,
      description: null,
      ...obj,
      user_id: user.id
    }
    return this.db.one(sql.addList, values)
  }

  editList(id, obj) {
    const values = {...obj, id: parseInt(id)}
    return this.db.one(sql.editList, values)
  }

  showList(id) {
    return this.db.one(sql.showList, {id: parseInt(id)})
  }

  showListWithLocations(id) {
    return this.db.one(sql.showListWithLocations, {id: parseInt(id)})
  }

  listUserLists(user_id) {
    return this.db.any(sql.listUserLists, {user_id: parseInt(user_id)})
  }

  listUserListsWithLocations(user_id) {
    return this.db.any(sql.listUserListsWithLocations, {user_id: parseInt(user_id)})
  }

  deleteList(id) {
    return this.db.none(sql.deleteList, {id: parseInt(id)})
  }

  addLocationToList(location_id, list_id) {
    return this.db.none(
      sql.addLocationToList,
      {
        location_id: parseInt(location_id),
        list_id: parseInt(list_id)
      }
    )
  }

  dropLocationFromList(location_id, list_id) {
    return this.db.none(
      sql.dropLocationFromList,
      {
        location_id: parseInt(location_id),
        list_id: parseInt(list_id)
      }
    )
  }
}

module.exports = LocationLists

import sqlModule from '../sql'
import type { Protocol, Pgp } from '../types'
import type {
  EditLocationList,
  LocationList,
} from '../../schemas/schemas'

const sql = sqlModule.locationLists

class LocationLists {
  db: Protocol
  pgp: Pgp

  constructor(db: Protocol, pgp: Pgp) {
    this.db = db
    this.pgp = pgp
  }

  addList(
    obj: Partial<EditLocationList> & Record<string, unknown>,
    user: { id: number },
  ): Promise<LocationList> {
    const values = {
      name: null,
      description: null,
      ...obj,
      user_id: user.id,
    }
    return this.db.one(sql.addList, values)
  }

  editList(
    id: number | string,
    obj: Partial<EditLocationList> & Record<string, unknown>,
  ): Promise<LocationList> {
    const values = { ...obj, id: parseInt(String(id)) }
    return this.db.one(sql.editList, values)
  }

  showList(id: number | string): Promise<LocationList> {
    return this.db.one(sql.showList, { id: parseInt(String(id)) })
  }

  showListWithLocations(id: number | string): Promise<LocationList> {
    return this.db.one(sql.showListWithLocations, { id: parseInt(String(id)) })
  }

  listUserLists(user_id: number | string): Promise<LocationList[]> {
    return this.db.any(sql.listUserLists, { user_id: parseInt(String(user_id)) })
  }

  listUserListsWithLocations(user_id: number | string): Promise<LocationList[]> {
    return this.db.any(sql.listUserListsWithLocations, {
      user_id: parseInt(String(user_id)),
    })
  }

  deleteList(id: number | string) {
    return this.db.none(sql.deleteList, { id: parseInt(String(id)) })
  }

  addLocationToList(location_id: number | string, list_id: number | string) {
    return this.db.none(sql.addLocationToList, {
      location_id: parseInt(String(location_id)),
      list_id: parseInt(String(list_id)),
    })
  }

  dropLocationFromList(location_id: number | string, list_id: number | string) {
    return this.db.none(sql.dropLocationFromList, {
      location_id: parseInt(String(location_id)),
      list_id: parseInt(String(list_id)),
    })
  }
}

export default LocationLists

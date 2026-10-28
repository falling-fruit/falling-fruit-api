import type { Db } from '../db/types'
import type Tokenizer from '../tokens'
import makeMiddleware = require('../middleware')
import createMailer = require('../mailer')
import createPhotos = require('../photos')

export type Middleware = ReturnType<typeof makeMiddleware>
export type Mailer = ReturnType<typeof createMailer>
export type Photos = ReturnType<typeof createPhotos>

export interface Services {
  db: Db
  middleware: Middleware
  tokenizer: Tokenizer
  mailer: Mailer
  photos: Photos
  postmarkServerId: number | undefined
  postmarkBroadcastStream: string | undefined
}

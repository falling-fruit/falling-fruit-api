import type { Db } from '../db/types'
import type Tokenizer from '../tokens'
import type { Auth } from '../auth'
import type makeMiddleware from '../middleware'
import type createMailer from '../mailer'
import type createPhotos from '../photos'

export type Middleware = ReturnType<typeof makeMiddleware>
export type Mailer = ReturnType<typeof createMailer>
export type Photos = ReturnType<typeof createPhotos>

export interface Services {
  db: Db
  middleware: Middleware
  auth: Auth
  tokenizer: Tokenizer
  mailer: Mailer
  photos: Photos
  postmarkServerId: number | undefined
  postmarkBroadcastStream: string | undefined
}

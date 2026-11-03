import type { Db } from '../db/types'
import type Tokenizer from '../tokens'
import type { Auth } from '../auth'
import type makeMiddleware from '../middleware'
import type Mailer from '../mail/mailer'
import type Photos from '../photos/photos'

export type Middleware = ReturnType<typeof makeMiddleware>

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

import { RecaptchaV2 } from 'express-recaptcha'

import makeDb from './db'
import Tokenizer from './tokens'
import makeAuth from './auth'
import Mailer from './mail/mailer'
import { createEmailClient } from './mail/email_client'
import Photos from './photos/photos'
import { createPhotoStorage } from './photos/storage'
import makeMiddleware from './middleware'
import makeRoutes from './routes'
import type { Config } from './config'
import type { Db } from './db/types'
import type { EmailClient } from './mail/email_client'
import type { PhotoStorage } from './photos/storage'

function createDependencies(config: Config) {
  const db = makeDb(config.dbUrl, true)
  const postmarkClient = createEmailClient(config)
  const photoStorage = createPhotoStorage(config)
  const recaptcha = makeMiddleware.createRecaptcha(config)

  return createDependenciesForClients(config, {
    db,
    postmarkClient,
    photoStorage,
    recaptcha,
  })
}

function createDependenciesForClients(
  config: Config,
  {
    db,
    postmarkClient,
    photoStorage,
    recaptcha,
  }: {
    db: Db
    postmarkClient: EmailClient
    photoStorage: PhotoStorage
    recaptcha: RecaptchaV2 | null
  },
) {
  const tokenizer = new Tokenizer(config.jwtSecret ?? '')
  const auth = makeAuth({ tokenizer })
  const mailer = new Mailer({
    client: postmarkClient,
    webOrigin: config.webOrigin,
  })
  const photos = new Photos({
    storage: photoStorage,
  })
  const middleware = makeMiddleware({
    db,
    tokenizer,
    recaptcha,
    postmarkSecret: config.postmark?.secret,
  })
  const routes = makeRoutes({
    db,
    tokenizer,
    middleware,
    auth,
    mailer,
    photos,
    postmarkServerId: config.postmark?.serverId,
    postmarkBroadcastStream: config.postmark?.broadcastStream,
  })

  return { db, tokenizer, auth, mailer, photos, middleware, routes }
}

createDependencies.createDependenciesForClients = createDependenciesForClients

export default createDependencies

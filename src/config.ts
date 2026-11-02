import dotenv from 'dotenv'
import { z } from 'zod'

dotenv.config()

const coreSchema = z.object({
  NODE_ENV: z.string().optional(),
  PORT: z.string().optional(),
  WEB_ORIGIN: z.url(),
  DB: z.url(),
  JWT_SECRET: z.string(),
})

const s3Schema = z.object({
  S3_REGION: z.string(),
  S3_BUCKET: z.string(),
  S3_ACCESS_KEY_ID: z.string(),
  S3_SECRET_ACCESS_KEY: z.string(),
})

const postmarkSchema = z.object({
  POSTMARK_API_TOKEN: z.string(),
  POSTMARK_SECRET: z.string(),
  POSTMARK_SERVER_ID: z.coerce.number(),
  POSTMARK_BROADCAST_STREAM: z.string(),
})

const recaptchaSchema = z.object({
  RECAPTCHA_SITE_KEY: z.string(),
  RECAPTCHA_SECRET_KEY: z.string(),
})

export type S3Config = {
  region: string
  bucket: string
  accessKeyId: string
  secretAccessKey: string
}

export type PostmarkConfig = {
  apiToken: string
  secret: string
  serverId: number
  broadcastStream: string
}

export type RecaptchaConfig = {
  siteKey: string
  secretKey: string
}

export type Config = {
  local: boolean
  port?: string
  webOrigin: string
  dbUrl?: string
  jwtSecret?: string
  s3: S3Config | null
  postmark: PostmarkConfig | null
  recaptcha: RecaptchaConfig | null
}

function parseBlock<Schema extends z.ZodObject, Block>(
  schema: Schema,
  env: NodeJS.ProcessEnv,
  local: boolean,
  build: (values: z.infer<Schema>) => Block,
): Block | null {
  const result = schema.safeParse(env)
  if (result.success) {
    return build(result.data)
  }
  const keys = Object.keys(schema.shape)
  const noneSet = keys.every((key) => env[key] == null || env[key] === '')
  if (local && noneSet) {
    return null
  }
  throw result.error
}

export function Config(env: NodeJS.ProcessEnv = process.env): Config {
  const core = coreSchema.parse(env)
  const local = core.NODE_ENV === 'development'

  return {
    local,
    port: core.PORT,
    webOrigin: core.WEB_ORIGIN,
    dbUrl: core.DB,
    jwtSecret: core.JWT_SECRET,
    s3: parseBlock(s3Schema, env, local, (values) => ({
      region: values.S3_REGION,
      bucket: values.S3_BUCKET,
      accessKeyId: values.S3_ACCESS_KEY_ID,
      secretAccessKey: values.S3_SECRET_ACCESS_KEY,
    })),
    postmark: parseBlock(postmarkSchema, env, local, (values) => ({
      apiToken: values.POSTMARK_API_TOKEN,
      secret: values.POSTMARK_SECRET,
      serverId: values.POSTMARK_SERVER_ID,
      broadcastStream: values.POSTMARK_BROADCAST_STREAM,
    })),
    recaptcha: parseBlock(recaptchaSchema, env, local, (values) => ({
      siteKey: values.RECAPTCHA_SITE_KEY,
      secretKey: values.RECAPTCHA_SECRET_KEY,
    })),
  }
}

export const config = Config()

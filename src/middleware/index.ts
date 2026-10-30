import makeCheckApiKey from './check_api_key'
import makeAuthenticatePostmark from './authenticate_postmark'
import makeRecaptcha from './recaptcha'
import test_review from './test_review'
import type { RecaptchaV2 } from 'express-recaptcha'
import type { Protocol } from '../db/types'
import type Tokenizer from '../tokens'

type MakeMiddlewareOptions = {
  db: Protocol
  tokenizer: Tokenizer
  recaptcha: RecaptchaV2 | null
  postmarkSecret: string | undefined
}

type Middleware = {
  check_api_key: ReturnType<typeof makeCheckApiKey>
  authenticate_postmark: ReturnType<typeof makeAuthenticatePostmark>
  recaptcha: ReturnType<typeof makeRecaptcha>
  test_review: typeof test_review
}

function makeMiddleware({
  db,
  recaptcha,
  postmarkSecret,
}: MakeMiddlewareOptions): Middleware {
  return {
    check_api_key: makeCheckApiKey({ db }),
    authenticate_postmark: makeAuthenticatePostmark({ postmarkSecret }),
    recaptcha: makeRecaptcha({ recaptcha }),
    test_review,
  }
}

export default makeMiddleware

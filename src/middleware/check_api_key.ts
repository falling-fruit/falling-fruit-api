import type { Request, Response, NextFunction } from 'express'
import type { Protocol } from '../db/types'

function makeCheckApiKey({ db }: { db: Protocol }) {
  return async function check_api_key(
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
    const key = req.header('x-api-key') || req.query.api_key
    if (!key) {
      return void res.status(401).json({ error: 'API key is missing' })
    }
    const matches = await db.any<{ id: number }>(
      'SELECT id FROM api_keys WHERE api_key=${key}',
      { key: key },
    )
    if (matches.length === 0) {
      return void res.status(401).json({ error: 'API key is invalid' })
    }
    return void next()
  }
}

export default makeCheckApiKey

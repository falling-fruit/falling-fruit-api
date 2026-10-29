import pgPromise from 'pg-promise'
import type { QueryFile } from 'pg-promise'
import path from 'path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/** A set of named SQL query files loaded from a directory. */
type SqlSet = Record<string, QueryFile>

/** All SQL query sets, keyed by repository directory name. */
type Sql = Record<string, SqlSet>

const sql = pgPromise.utils.enumSql(__dirname, { recursive: true }, (file) => {
  return new pgPromise.QueryFile(file, {
    minify: true,
  })
}) as unknown as Sql

export default sql

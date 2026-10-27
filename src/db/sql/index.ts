import pgPromise, { QueryFile } from 'pg-promise'

const { enumSql } = pgPromise.utils

/** A set of named SQL query files loaded from a directory. */
type SqlSet = Record<string, QueryFile>

/** All SQL query sets, keyed by repository directory name. */
type Sql = Record<string, SqlSet>

const sql = enumSql(__dirname, { recursive: true }, (file) => {
  return new QueryFile(file, {
    minify: true,
  })
}) as unknown as Sql

export = sql

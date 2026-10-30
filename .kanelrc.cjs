const { resolve } = require('path')
require('dotenv').config({ path: resolve(__dirname, '.env.test') })

/** @type {import('kanel').Config} */
module.exports = {
  connection: process.env.DATABASE_URL,
  schemas: ['public'],
  outputPath: './src/db/generated',
  preDeleteOutputFolder: true,
  enumStyle: 'type',
  tsModuleFormat: 'esm',
  // NOTE: kanel prints "Unknown type 'geometry' / 'double precision'" for the
  // PostGIS SQL functions (st_buffer_meters, utmzone). These only affect the
  // generated routine wrappers, which the app does not consume, so the warnings
  // are harmless. Table columns map correctly via customTypeMap below.
  customTypeMap: {
    // INT8/BIGINT arrive as JS numbers: see setTypeParser(INT8, parseInt) in src/db/index.ts.
    // (kanel defaults int8 to string.)
    'pg_catalog.int8': 'number',
    // PostGIS geometry/geography are serialized to GeoJSON strings over the wire
    // and parsed in the mappers (e.g. src/mappers/user.ts). Not in kanel's defaults.
    'public.geometry': 'string',
    'public.geography': 'string',
  },
}

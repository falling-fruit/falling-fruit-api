import test from 'node:test'
import assert from 'node:assert/strict'

import Type = require('../../src/mappers/type')
import type { Type as ApiType } from '../../src/schemas/schemas'

type TypeInput = Partial<ApiType> & Record<string, unknown>

const nameColumns = ['en_name', 'es_name', 'fr_name', 'zh_tw_name']
const defaultNames = ['en_name', 'scientific_name']

function roundTrip(apiObj: TypeInput) {
  const input = structuredClone(apiObj)
  return Type.fromRow(Type.toRow(input, { nameColumns, defaultNames }))
}

const fixtures: Record<string, TypeInput> = {
  'full type': {
    id: 1,
    parent_id: null,
    common_names: {
      en: ['Apple', 'Common apple'],
      es: ['Manzano'],
      'zh-tw': ['蘋果']
    },
    scientific_names: ['Malus domestica', 'Malus pumila'],
    categories: ['forager', 'grafter'],
    urls: {
      usda: 'https://plants.usda.gov/home/plantProfile?symbol=MADO2'
    },
    taxonomic_rank: 20,
    pending: false,
    user_id: 42
  },
  'minimal type': {
    id: 2,
    common_names: { en: ['Pear'] },
    scientific_names: [],
    categories: []
  },
  'locale overflow into notes': {
    id: 3,
    common_names: {
      en: ['Fig'],
      de: ['Feige'],
      ja: ['イチジク']
    },
    scientific_names: ['Ficus carica'],
    categories: ['freegan']
  }
}

for (const [name, apiObj] of Object.entries(fixtures)) {
  test(`fromRow(toRow(...)) is idempotent for ${name}`, () => {
    const once = roundTrip(apiObj)
    const twice = roundTrip(once)
    assert.deepEqual(twice, once)
  })
}

import type { Type } from '../schemas/schemas'
import type { default as TypesRow } from '../db/generated/public/Types'

type TypeCategory = 'forager' | 'freegan' | 'honeybee' | 'grafter'

const TYPE_CATEGORIES: TypeCategory[] = [
  'forager',
  'freegan',
  'honeybee',
  'grafter',
]

// Columns from DB but also enriched fields like common_names, urls
type TypeRow = Partial<Record<keyof TypesRow, any>> & Record<string, any>

type ToRowOptions = {
  nameColumns: string[]
  defaultNames: string[]
}

// ---- bitfield helpers

function mask_bits<T>(selected: T[], all: T[]): number {
  return all.reduce(
    (acc, curr, i) => acc | (selected.includes(curr) ? 1 << i : 0),
    0,
  )
}

function unmask_bits<T>(mask: number, all: T[]): T[] {
  return all.filter((_, i) => mask & (1 << i))
}

/**
 * Resolve a locale (e.g. 'zh-TW') to its flat column name (e.g. 'zh_tw_name').
 *
 * @param locale
 * @returns Column name.
 */
function locale_to_name(locale: string): string {
  const prefix = locale.toLowerCase().replace('-', '_')
  return `${prefix}_name`
}

export default {
  locale_to_name,

  /**
   * Convert a database row into the nested API object.
   *
   * @param type - Raw type row.
   * @returns API-shaped type.
   */
  fromRow(type: TypeRow): Type {
  const replaced: string[] = []
  // Format scientific names: [name, synonyms...]
  type.scientific_names = []
  if (type.scientific_name) {
    type.scientific_names.push(type.scientific_name)
  }
  if (type.scientific_synonyms) {
    type.scientific_names.push(...type.scientific_synonyms.split(', '))
  }
  replaced.push('scientific_name', 'scientific_synonyms')
  // Format common names: {locale: [name, synonyms...], ...}
  type.common_names = {}
  // Format urls: {tag: url, ...}
  type.urls = {}
  for (const key in type) {
    if (key == 'scientific_name') {
      continue
    }
    if (key.endsWith('_name')) {
      replaced.push(key)
      if (type[key]) {
        type.common_names[key.replace('_name', '')] = type[key].split(', ')
      }
    } else if (key.endsWith('_url')) {
      replaced.push(key)
      if (type[key]) {
        type.urls[key.replace('_url', '')] = type[key]
      }
    }
  }
  // Extract common names from notes
  if (type.notes) {
    const regex = /^common_names\.([a-z]{2}(?:_[a-z]{2})?): ([^\n]+)$/gm
    let match
    while ((match = regex.exec(type.notes)) !== null) {
      const [_, locale, names] = match
      type.common_names[locale] = names.split(', ')
    }
  }
  delete type.notes
  // Append English synonyms
  if (type.en_synonyms) {
    const synonyms = type.en_synonyms.split(', ')
    if ('en' in type.common_names) {
      type.common_names.en.push(...synonyms)
    } else {
      type.common_names.en = synonyms
    }
  }
  replaced.push('en_synonyms')
  // Replace _ with - in all common name keys
  for (const key in type.common_names) {
    if (key.includes('_')) {
      const new_key = key.replace('_', '-')
      type.common_names[new_key] = type.common_names[key]
      delete type.common_names[key]
    }
  }
  // TEMP: Generate USDA URL from symbol
  if (type.usda_symbol) {
    type.urls.usda = `https://plants.usda.gov/home/plantProfile?symbol=${type.usda_symbol}`
  }
  replaced.push('usda_symbol')
  // Format categories: {categories: [category, ...]}
  type.categories = unmask_bits(type.category_mask, TYPE_CATEGORIES)
  replaced.push('category_mask')
  // Drop replaced properties
  for (const key of replaced) {
    delete type[key]
  }
  return type as Type
  },

  /**
   * Convert an API object into a complete database row.
   *
   * @param obj - API-shaped type (from a request body).
   * @param options
   * @param options.nameColumns - Existing `*_name` columns on the table.
   * @param options.defaultNames - Columns that satisfy the "default name"
   *   requirement, in priority order (e.g. ['en_name', 'scientific_name']).
   * @returns Full type row, ready to insert.
   */
  toRow(
    obj: Partial<Type> & Record<string, unknown>,
    { nameColumns, defaultNames }: ToRowOptions,
  ): TypeRow {
  // Deconstruct nested fields back into flat columns.
  let values: TypeRow = {
    parent_id: null,
    common_names: {},
    scientific_names: [],
    taxonomic_rank: null,
    notes: null,
    pending: true,
    categories: [],
    user_id: null,
    ...obj,
  }
  // Extract English name and synonyms
  if ('en' in values.common_names) {
    values.en_name = values.common_names.en[0]
    values.en_synonyms = values.common_names.en.slice(1).join(', ') || null
    delete values.common_names['en']
  }
  // Flatten scientific names
  if (values.scientific_names) {
    values.scientific_name = values.scientific_names[0]
    values.scientific_synonyms =
      values.scientific_names.slice(1).join(', ') || null
    delete values.scientific_names
  }
  // Encode categories into the bitfield
  if (values.categories) {
    values.category_mask = mask_bits(values.categories, TYPE_CATEGORIES)
    delete values.categories
  }
  // Fill in the full column skeleton.
  values = {
    ...Object.fromEntries(nameColumns.map((x) => [x, null])),
    en_synonyms: null,
    scientific_synonyms: null,
    category_mask: null,
    ...values,
  }
  // Determine whether default name is present
  let has_default = defaultNames.some((name) => Boolean(values[name]))
  // Transfer remaining names to a language_name column, if it exists, or to notes
  for (const [locale, names] of Object.entries<string[]>(
    values.common_names,
  )) {
    const column = locale_to_name(locale)
    if (nameColumns.includes(column)) {
      values[column] = names.join(', ')
    } else {
      values.notes = [
        values.notes || '',
        `common_names.${locale}: ${names.join(', ')}`,
      ]
        .filter(Boolean)
        .join('\n')
    }
    // Use first name as default if no default name is present
    if (!has_default) {
      values[defaultNames[0]] = names[0]
      has_default = true
    }
  }
  delete values.common_names
  return values
  },
}


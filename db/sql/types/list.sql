SELECT
  id, parent_id, pending,
  created_at, updated_at,
  scientific_name, scientific_synonyms, taxonomic_rank,
  en_name, en_synonyms,
  ar_name, de_name, el_name, es_name, fr_name, he_name, it_name, nl_name,
  pl_name, pt_name, sk_name, sv_name, tr_name, uk_name,
  vi_name, zh_hans_name, zh_hant_name,
  eat_the_weeds_url, foraging_texas_url, fruitipedia_url, urban_mushrooms_url, wikipedia_url,
  usda_symbol,
  category_mask,
  notes
FROM types

SELECT t.id, scientific_name, COALESCE(${locales:raw}) as common_name, SUM(count) as count
FROM types t, clusters c
WHERE c.type_id = t.id AND t.id ${types:raw} AND zoom = ${zoom:raw} AND muni ${muni:raw} AND ${bounds:raw}
GROUP BY t.id, common_name, scientific_name
ORDER BY scientific_name, taxonomic_rank, common_name

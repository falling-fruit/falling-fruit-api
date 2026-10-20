SELECT type_id as id, SUM(count) as count
FROM clusters
where zoom = ${zoom} AND ${where:raw}
GROUP BY type_id;

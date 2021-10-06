WITH mvtgeom AS
(
    SELECT ST_AsMVTGeom(geom, ST_TileEnvelope(${z}, ${x}, ${y})) AS geom, id
    FROM locations
    WHERE geom && ST_TileEnvelope(${z}, ${x}, ${y})
)
SELECT ST_AsMVT(mvtgeom.*) as tile
FROM mvtgeom

insert into tiles (z, x, y, mvt, bbox)
select
  ${z},
  ${x},
  ${y},
  ST_AsMVT(mvtgeom, 'locations', ${pixels}, 'geom') as mvt,
  ST_TileEnvelope(${z}, ${x}, ${y}) as bbox
from (
  select
    st_asmvtgeom(
      st_point(cx, cy),
      bounds := ST_TileEnvelope(${z}, ${x}, ${y}),
      extent := ${pixels},
      buffer := 0,
      clip_geom := false
    ) as geom
    -- , count(1) count
    , array_agg(distinct type_id) as type_ids
  from (
    select
        round(st_x(geom) / ${size}) * ${size} as cx,
        round(st_y(geom) / ${size}) * ${size} as cy
        , unnest(type_ids) as type_id
    from locations
    where geom && ST_TileEnvelope(${z}, ${x}, ${y})
  ) agg
  group by cx, cy
) mvtgeom
returning mvt;

import { z, register } from './registry'

export const Point = register(
  'Point',
  z.array(z.number()).min(2).max(3).openapi({
    description:
      'Point coordinates as longitude and latitude (in WGS84 decimal degrees), and optional elevation.\n',
    externalDocs: { url: 'https://tools.ietf.org/html/rfc7946#section-3.1.1' },
  }),
)

export const LinearRing = register(
  'LinearRing',
  z.array(Point).min(4).openapi({
    description:
      'Closed line with four or more points. The first and last MUST contain identical values, and the line MUST follow the right-hand rule with respect to the area it bounds: exterior rings are counterclockwise, and holes are clockwise.\n',
    externalDocs: { url: 'https://tools.ietf.org/html/rfc7946#section-3.1.6' },
    example: [
      [-105.3736, 39.9642],
      [-105.1635, 39.9642],
      [-105.1635, 40.0891],
      [-105.3736, 40.0891],
      [-105.3736, 39.9642],
    ],
  }),
)

export const Polygon = register(
  'Polygon',
  z
    .object({
      type: z.enum(['Polygon']).openapi({
        description: 'GeoJSON geometry type.',
      }),
      coordinates: z.array(LinearRing).openapi({
        description:
          'GeoJSON polygon coordinates (WGS84). The first linear ring represents the exterior ring. Any subsequent linear rings represent interior holes.',
      }),
    })
    .openapi({
      externalDocs: { url: 'https://geojson.org/geojson-spec.html#id4' },
    }),
)

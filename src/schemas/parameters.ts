import { z, registry } from './registry'

const BOUNDS_ITEM_PATTERN = '^(-?\\d+\\.?(\\d+)?),(-?\\d+\\.?(\\d+)?)$'

export const boundsParam = registry.registerParameter(
  'bounds',
  z
    .array(z.string().regex(new RegExp(BOUNDS_ITEM_PATTERN)))
    .min(2)
    .max(2)
    .openapi('bounds', {
      param: {
        name: 'bounds',
        in: 'query',
        required: true,
        explode: false,
        style: 'pipeDelimited',
      },
      description:
        'The southwest and northeast corners of the bounding box in WGS84 decimal degrees, in the format `swlat,swlng|nelat,nelng`. Latitude must be in the interval [-90, 90] and longitude must be in the interval [-180, 180]. `swlat` must be less than `nelat`, but `swlng` can be larger than `nelng` if the box crosses the line of 180 degrees longitude.',
      example: ['-5,-180', '5,180'],
    }),
)

export const zoomParam = registry.registerParameter(
  'zoom',
  z.number().int().min(0).max(14).default(0).openapi('zoom', {
    param: { name: 'zoom', in: 'query' },
    description:
      'Zoom level, where the world is divided into a 2<sup>zoom</sup> x 2<sup>zoom</sup> grid.',
  }),
)

export const muniParam = registry.registerParameter(
  'muni',
  z.boolean().default(true).openapi('muni', {
    param: { name: 'muni', in: 'query' },
    description:
      'Whether to include Locations imported from municipal tree inventories.',
  }),
)

export const typesParam = registry.registerParameter(
  'types',
  z
    .array(z.number().int().min(0))
    .openapi('types', {
      param: { name: 'types', in: 'query', explode: false },
      description: 'IDs of Types to include (all by default).',
      uniqueItems: true,
      default: null,
    }),
)

export const invasiveParam = registry.registerParameter(
  'invasive',
  z.boolean().default(false).openapi('invasive', {
    param: { name: 'invasive', in: 'query' },
    description:
      'Whether to only return Locations with Types locally flagged as invasive species. Note that this parameter is not supported for filtering clusters.',
  }),
)

function idPathParam(
  id: string,
  name: string,
  description: string,
) {
  return registry.registerParameter(
    id,
    z.coerce.number().int().min(1).openapi(id, {
      param: { name, in: 'path', required: true },
      description,
    }),
  )
}

export const locationIdParam = idPathParam(
  'location_id',
  'id',
  'Location ID.',
)
export const locationListIdParam = idPathParam(
  'location_list_id',
  'list_id',
  'Location List ID.',
)
export const typeIdParam = idPathParam('type_id', 'id', 'Type ID.')
export const reviewIdParam = idPathParam('review_id', 'id', 'Review ID.')
export const userIdParam = idPathParam('user_id', 'id', 'User ID.')
export const importIdParam = idPathParam('import_id', 'id', 'Import ID.')

export const recaptchaParam = registry.registerParameter(
  'recaptcha',
  z.string().min(1).openapi('recaptcha', {
    param: { name: 'g-recaptcha-response', in: 'header', required: false },
    description:
      'User response token for a Google reCAPTCHA v2 (see https://developers.google.com/recaptcha/docs/verify).\nMay be passed as a header or query parameter, or in the request body.\nOnly required if user authentication (if available for the endpoint) is not provided.\n',
  }),
)

export const offsetParam = registry.registerParameter(
  'offset',
  z.number().int().min(0).default(0).openapi('offset', {
    param: { name: 'offset', in: 'query' },
    description: 'Offset from which to apply `limit`.',
  }),
)

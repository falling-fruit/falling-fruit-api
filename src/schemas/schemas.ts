import { z, register, allOf, inlineAllOf } from './registry'
import { Polygon } from './geojson'
import { emailProp, nameProp, bioProp } from './properties'

// Shared field fragments (composed via allOf)

export const IdField = register(
  'IdField',
  z.object({
    id: z.number().int().min(1).openapi({
      description: 'Unique identifier.',
      example: 42,
    }),
  }),
)

export const LatLngFields = register(
  'LatLngFields',
  z.object({
    lat: z.number().min(-85.0511).max(85.0511).optional().openapi({
      description: 'Latitude in WGS84 decimal degrees.',
      example: 45.6789,
    }),
    lng: z.number().min(-180).max(180).optional().openapi({
      description: 'Longitude in WGS84 decimal degrees.',
      example: -123.45678,
    }),
  }),
)

export const DateFields = register(
  'DateFields',
  z.object({
    created_at: z.string().datetime({ offset: true }).openapi({
      description:
        'Date and time created in format YYYY-MM-DDThh:mm:ss.sssZ.',
      format: 'date-time',
      example: '2014-06-19T01:02:03.456Z',
    }),
    updated_at: z.string().datetime({ offset: true }).openapi({
      description:
        'Date and time last updated in format YYYY-MM-DDThh:mm:ss.sssZ.',
      format: 'date-time',
      example: '2014-07-20T12:34:56.789Z',
    }),
  }),
)

// Clusters

export const Cluster = allOf('Cluster', [
  LatLngFields,
  z.object({
    lat: z.number().min(-85.0511).max(85.0511),
    lng: z.number().min(-180).max(180),
    count: z.number().int().min(1).openapi({
      description:
        'Number of Locations. Locations with multiple Types are counted as their number of Types.',
      example: 768,
    }),
  }),
]).openapi({
  title: 'Cluster',
  description: 'Number of Locations in an area.',
})

export const TypeCount = register(
  'TypeCount',
  z
    .object({
      id: z.number().int().min(1).openapi({
        description: 'Type ID.',
        example: 1,
      }),
      count: z.number().int().min(1).openapi({
        description: 'Number of Locations with that Type ID.',
        example: 12,
      }),
    })
    .openapi({
      title: 'Type count',
      description: 'Number of Location Types in an area.',
    }),
)

// Types

export const BaseType = register(
  'BaseType',
  z
    .object({
      parent_id: z.number().int().min(1).nullable().optional().openapi({
        description: 'Type ID of taxonomic parent.',
        example: 114,
      }),
      pending: z.boolean().optional().openapi({
        description:
          'Whether pending admin review. This is always true unless set to false by an admin (not implemented).',
        example: true,
        default: true,
      }),
      scientific_names: z
        .array(z.string().min(1))
        .optional()
        .openapi({
          description:
            "Scientific names, starting with the preferred synonym.\n- Genus (or higher rank): Prunus\n- Subgenus: Prunus subg. Amygdalus\n- Species: Prunus domestica\n- Subspecies: Prunus domestica subsp. domestica, Prunus persica var. nucipersica, Brassica oleracea var. capitata f. rubra\n- Hybrid: Prunus x eminens, Prunus cerasus x Prunus fruticosa\n- Cultivar: Prunus persica 'George IV', Prunus domestica subsp. domestica 'Italian', Acer truncatum x platanoides 'Keithsform'\n",
          example: ['Malus pumila', 'Malus domestica', 'Malus communis'],
        }),
      taxonomic_rank: z
        .number()
        .int()
        .min(0)
        .max(9)
        .nullable()
        .optional()
        .openapi({
          description:
            'Taxonomic rank.\n- 0: Polyphyletic\n- 1: Kingdom\n- 2: Phylum\n- 3: Class\n- 4: Order\n- 5: Family\n- 6: Genus\n- 7: Multispecies\n- 8: Species\n- 9: Subspecies\n',
          example: 8,
        }),
      common_names: z
        .record(z.string(), z.array(z.string().min(1)))
        .optional()
        .openapi({
          description:
            'Common names, starting with the preferred synonym, by language code. Use `zh-hans` for simplified Chinese characters and `zh-hant` for traditional Chinese. Any language not in the example is read and written to the notes. If no scientific name or English (`en`) common name is provided, the first common name is used as the default name.',
          example: {
            ar: ['تفاح'],
            de: ['Apfel'],
            el: ['Μηλιά'],
            en: ['Apple', 'Orchard apple', 'Paradise apple'],
            es: ['Pero'],
            fr: ['Pommier commun'],
            he: ['תפוח תרבותי'],
            it: ['Melo'],
            ja: ['リンゴ'],
            nl: ['Appel'],
            pl: ['Jabłoń domowa'],
            pt: ['Maçã'],
            sk: ['Jablko'],
            sv: ['Jabolko'],
            tr: ['Elma'],
            uk: ['Яблуко'],
            vi: ['Táo tây'],
            'zh-hans': ['苹果'],
            'zh-hant': ['蘋果'],
          },
        }),
      categories: z
        .array(z.enum(['forager', 'freegan', 'honeybee', 'grafter']))
        .optional()
        .openapi({
          description: 'Categories.',
          example: ['forager'],
        }),
    })
    .openapi({
      title: 'Type (base)',
      description: 'Type properties that can be edited.',
    }),
)

export const SubmitType = allOf('SubmitType', [
  BaseType,
  z.object({
    notes: z.string().min(1).nullable().optional().openapi({
      description: 'Submission notes.',
      example: 'The fruit are edible once cooked.',
    }),
  }),
]).openapi({
  title: 'Type (submit)',
  description:
    'Type properties that can be submitted. At least one name (in `common_names.en` or `scientific_names`) is required.',
})

export const Type = allOf('Type', [
  IdField,
  DateFields,
  BaseType,
  z.object({
    parent_id: z.number().int().min(1).nullable(),
    pending: z.boolean(),
    scientific_names: z.array(z.string().min(1)),
    taxonomic_rank: z.number().int().min(0).max(9).nullable(),
    common_names: z.record(z.string(), z.array(z.string().min(1))),
    urls: z
      .record(z.string(), z.string().min(1))
      .openapi({
        description:
          'Links to more information, by resource code.\n- wikipedia: English Wikipedia (https://en.wikipedia.org)\n- eat_the_weeds: Eat the Weeds (https://www.eattheweeds.com)\n- foraging_texas: Foraging Texas (https://www.foragingtexas.com)\n- urban_mushrooms: Urban Mushrooms (http://urbanmushrooms.com)\n- fruitipedia: Fruitipedia (http://www.fruitipedia.com)\n- usda: USDA Plants Database (https://plants.usda.gov)\n',
        example: {
          wikipedia: 'https://en.wikipedia.org/wiki/Malus_domestica',
          eat_the_weeds:
            'https://www.eattheweeds.com/apples-wild-crabapples',
        },
      }),
  }),
]).openapi({
  title: 'Type',
  description: 'All Type properties.',
})

// Locations

export const ListLocation = allOf('ListLocation', [
  IdField,
  LatLngFields,
  z.object({
    lat: z.number().min(-85.0511).max(85.0511),
    lng: z.number().min(-180).max(180),
    type_ids: z.array(z.number().int().min(1)).openapi({
      description: 'Type IDs.',
      example: [97, 92],
    }),
    in_list: z.boolean().optional().openapi({
      description:
        "Whether the Location is in any of the current user's lists. Only included if the user is authenticated.",
      example: true,
    }),
    distance: z.number().min(0).optional().openapi({
      description: 'Distance in meters from provided centerpoint.',
      example: 47.915,
    }),
    photo: z.any().optional().openapi({
      description: 'Path to review photo thumbnail, if available.',
    }),
    type_names: z.array(z.string()).optional().openapi({
      description: 'Type names.',
      example: ['Apple', 'Pear'],
    }),
  }),
]).openapi({
  title: 'Location (list)',
})

export const EditLocation = allOf('EditLocation', [
  LatLngFields,
  z.object({
    lat: z.number().min(-85.0511).max(85.0511),
    lng: z.number().min(-180).max(180),
    type_ids: z.array(z.number().int().min(1)).openapi({
      description: 'Type IDs.',
      example: [97, 92],
    }),
    unverified: z.boolean().optional().openapi({
      description:
        'Whether suspected to be wrong in some way and requires verification.',
      example: false,
    }),
    access: z
      .union([
        z.literal(0),
        z.literal(1),
        z.literal(2),
        z.literal(3),
        z.literal(4),
      ])
      .nullable()
      .optional()
      .openapi({
        description:
          'Access level.\n- 0: Location is on my property.\n- 1: I have permission from the owner to add this Location.\n- 2: Location is on public land.\n- 3: Location is on private property but overhangs public property.\n- 4: Location is on private property.\n',
        example: 3,
      }),
    description: z.string().min(1).nullable().optional().openapi({
      description: 'Description.',
      example:
        'Two mulberry trees with a few low branches overhanging the sidewalk.',
    }),
    season_start: z.number().int().min(0).max(11).optional().openapi({
      description: 'First month in season (zero-based).',
      example: 6,
    }),
    season_stop: z.number().int().min(0).max(11).optional().openapi({
      description: 'Last month in season (zero-based).',
      example: 8,
    }),
  }),
]).openapi({
  title: 'Location (edit)',
  description: 'Location properties that can be edited.',
})

// Reviews

export const BaseReview = register(
  'BaseReview',
  z
    .object({
      comment: z.string().min(1).nullable().optional().openapi({
        description: 'Comment.',
        example: 'The sidewalk is stained red with mulberries.',
      }),
      observed_on: z.string().date().nullable().optional().openapi({
        description:
          'Date visited in format YYYY-MM-DD. Cannot be in the future.',
        format: 'date',
        example: '2014-06-19',
      }),
      fruiting: z
        .union([z.literal(0), z.literal(1), z.literal(2)])
        .nullable()
        .optional()
        .openapi({
          description: 'Fruiting status.',
          example: 2,
        }),
      quality_rating: z
        .union([
          z.literal(0),
          z.literal(1),
          z.literal(2),
          z.literal(3),
          z.literal(4),
        ])
        .nullable()
        .optional()
        .openapi({
          description: 'Quality rating.',
          example: 2,
        }),
      yield_rating: z
        .union([
          z.literal(0),
          z.literal(1),
          z.literal(2),
          z.literal(3),
          z.literal(4),
        ])
        .nullable()
        .optional()
        .openapi({
          description: 'Yield rating.',
          example: 3,
        }),
    })
    .openapi({ title: 'Review (base)' }),
)

export const EditReview = allOf('EditReview', [
  BaseReview,
  z.object({
    photo_ids: z
      .array(z.number().int().min(1))
      .optional()
      .openapi({
        description:
          'IDs of photos to link to the review. Previously linked photos are unlinked if their ids are omitted. Photos are ordered by the order of their ids.',
        uniqueItems: true,
        example: [3, 1, 2],
      }),
  }),
]).openapi({
  title: 'Review (edit)',
  description: 'Review properties that can be edited.',
})

export const Photo = allOf('Photo', [
  IdField,
  DateFields,
  z.object({
    thumb: z.string().min(1).url().openapi({
      description: 'Path to thumbnail (longest dimension <= 100 px).',
      format: 'uri',
      example:
        'http://s3-us-west-2.amazonaws.com/fallingfruit-production/observations/photos/000/002/745/thumb/open-uri20131213-3992-1szjh9k.jpg',
    }),
    medium: z.string().min(1).url().openapi({
      description: 'Path to medium size file (longest dimension <= 300 px).',
      format: 'uri',
      example:
        'http://s3-us-west-2.amazonaws.com/fallingfruit-production/observations/photos/000/002/745/medium/open-uri20131213-3992-1szjh9k.jpg',
    }),
    original: z.string().min(1).url().openapi({
      description: 'Path to large size file (longest dimension <= 2048 px).',
      format: 'uri',
      example:
        'http://s3-us-west-2.amazonaws.com/fallingfruit-production/observations/photos/000/002/745/original/open-uri20131213-3992-1szjh9k.jpg',
    }),
  }),
]).openapi({
  title: 'Photo',
  description: 'Location photo.',
})

export const Review = allOf('Review', [
  IdField,
  BaseReview,
  DateFields,
  z.object({
    location_id: z.number().int().min(1).openapi({
      description: 'Location ID.',
      example: 3383,
    }),
    user_id: z.number().int().min(1).nullable().openapi({
      description: 'User ID.',
      example: 1,
    }),
    author: z.string().min(1).nullable().openapi({
      description:
        'Author name. Either a hardcoded `author` or the current `name` of the associated User.',
      example: 'Ethan',
    }),
    comment: z.string().min(1).nullable(),
    fruiting: z
      .union([z.literal(0), z.literal(1), z.literal(2)])
      .nullable(),
    quality_rating: z
      .union([
        z.literal(0),
        z.literal(1),
        z.literal(2),
        z.literal(3),
        z.literal(4),
      ])
      .nullable(),
    yield_rating: z
      .union([
        z.literal(0),
        z.literal(1),
        z.literal(2),
        z.literal(3),
        z.literal(4),
      ])
      .nullable(),
    observed_on: z.string().date().nullable(),
    photos: z.array(Photo),
  }),
]).openapi({
  title: 'Review',
  description: 'Observations of and opinions about a Location.',
})

export const Import = allOf('Import', [
  IdField,
  DateFields,
  z.object({
    name: z.string().min(1).openapi({
      description: 'Name.',
      example: 'Les arbres de Grenoble',
    }),
    url: z.string().url().nullable().openapi({
      description: 'Path to a description of the data.',
      format: 'uri',
      example:
        'http://data.metropolegrenoble.fr/ckan/dataset/les-arbres-de-grenoble',
    }),
    comments: z.string().min(1).nullable().openapi({
      description: 'Description and import comments.',
      example: 'Tree inventory of Grenoble, France.',
    }),
    license: z.string().min(1).nullable().openapi({
      description: 'License.',
      example:
        'Open Data Commons Open Database License (https://opendefinition.org/licenses/odc-odbl)',
    }),
    muni: z.boolean().openapi({
      description: 'Whether a municipal or university tree inventory.',
      example: true,
    }),
    location_count: z.number().int().min(0).openapi({
      description: 'Number of imported locations.',
      example: 1273,
    }),
  }),
]).openapi({
  title: 'Import',
  description: 'Imported dataset.',
})

// Location lists

export const EditLocationList = register(
  'EditLocationList',
  z
    .object({
      name: z.string().min(1).openapi({
        description: 'Name.',
        example: 'My favorite trees',
      }),
      description: z.string().min(1).nullable().optional().openapi({
        description: 'Description.',
        example: 'My favorite trees in Boulder, Colorado.',
      }),
    })
    .openapi({
      title: 'Location List (edit)',
      description: 'Location List properties that can be edited.',
    }),
)

export const LocationListLocation = allOf('LocationListLocation', [
  IdField,
  LatLngFields,
  z.object({
    lat: z.number().min(-85.0511).max(85.0511),
    lng: z.number().min(-180).max(180),
    type_ids: z.array(z.number().int().min(1)).openapi({
      description: 'Type IDs.',
      example: [97, 92],
    }),
    added_at: z.string().datetime({ offset: true }).openapi({
      description:
        'Date and time added to list, in format YYYY-MM-DDThh:mm:ss.sssZ.',
      format: 'date-time',
      example: '2014-06-19T01:02:03.456Z',
    }),
    address: z.string().min(1).nullable().optional().openapi({
      description: 'Address.',
      example: '748 10th Street, Boulder CO 80302, USA',
    }),
  }),
]).openapi({
  title: 'Location List Location',
  description: 'Location in a Location List.',
})

export const LocationList = allOf('LocationList', [
  IdField,
  DateFields,
  EditLocationList,
  z.object({
    user_id: z.number().int().min(1).openapi({
      description: 'User ID.',
      example: 1,
    }),
    name: z.string().min(1),
    locations: z
      .array(LocationListLocation)
      .optional()
      .openapi({
        description:
          'Locations in the list, in order of addition or, for legacy routes, custom arbitrary order.',
      }),
  }),
]).openapi({
  title: 'Location List',
  description: 'List of saved locations.',
})

export const AddLocation = allOf('AddLocation', [
  EditLocation,
  z.object({
    review: EditReview.optional(),
  }),
]).openapi({
  title: 'Location (add)',
  description: 'Location properties that can be added.',
})

export const Location = allOf('Location', [
  IdField,
  EditLocation,
  DateFields,
  z.object({
    lat: z.number().min(-85.0511).max(85.0511),
    lng: z.number().min(-180).max(180),
    type_ids: z.array(z.number().int().min(1)),
    unverified: z.boolean(),
    access: z
      .union([
        z.literal(0),
        z.literal(1),
        z.literal(2),
        z.literal(3),
        z.literal(4),
      ])
      .nullable(),
    description: z.string().min(1).nullable(),
    season_start: z.number().int().min(0).max(11),
    season_stop: z.number().int().min(0).max(11),
    user_id: z.number().int().min(1).nullable().optional().openapi({
      description: 'User ID.',
      example: 1,
    }),
    author: z.string().min(1).nullable().openapi({
      description:
        'Author name. Either a hardcoded `author` or the current `name` of the associated User.',
      example: 'Ethan',
    }),
    address: z.string().min(1).nullable().openapi({
      description:
        'Address. Either provided for imported locations whose coordinates had to be geocoded from the address or reverse-geocoded from coordinates.',
      example: '748 10th Street, Boulder CO 80302, USA',
    }),
    city: z.string().min(1).nullable().openapi({
      description: 'City (reverse-geocoded from coordinates).',
      example: 'Boulder',
    }),
    state: z.string().min(1).nullable().openapi({
      description: 'State (reverse-geocoded from coordinates).',
      example: 'Colorado',
    }),
    country: z.string().min(1).nullable().openapi({
      description: 'County (reverse-geocoded from coordinates).',
      example: 'United States',
    }),
    muni: z.boolean().openapi({
      description: 'Whether imported from a municipal tree inventory.',
      example: false,
    }),
    import_id: z.number().int().min(1).nullable().optional().openapi({
      description: 'Import ID.',
      example: 42,
    }),
    import: Import.optional(),
    reviews: z.array(Review).optional().openapi({
      description: 'Location reviews.',
    }),
    lists: z.array(LocationList).openapi({
      description: "User's lists that include the Location.",
    }),
  }),
]).openapi({
  title: 'Location',
  description: 'All Location properties.',
})

export const LocationChange = allOf('LocationChange', [
  LatLngFields,
  z.object({
    lat: z.number().min(-85.0511).max(85.0511),
    lng: z.number().min(-180).max(180),
    created_at: z.string().datetime({ offset: true }).openapi({
      description:
        'Date and time created in format YYYY-MM-DDThh:mm:ss.sssZ.',
      format: 'date-time',
      example: '2014-06-19T01:02:03.456Z',
    }),
    description: z.enum(['added', 'edited', 'visited']).openapi({
      description:
        'Change type.\n- `added`: Location added.\n- `edited`: Location edited.\n- `visited`: Location reviewed.\n',
      example: 'added',
    }),
    location_id: z.number().int().min(1).openapi({
      description: 'Location ID.',
      example: 114,
    }),
    type_ids: z.array(z.number().int().min(1)).openapi({
      description: 'Current location type IDs.',
      example: [97, 92],
    }),
    review_id: z.number().int().min(1).nullable().optional().openapi({
      description: "Review ID. Only defined for `'visited'`.",
      example: 3383,
    }),
    user_id: z.number().int().min(1).nullable().optional().openapi({
      description: 'User ID.',
      example: 1,
    }),
    author: z.string().min(1).nullable().optional().openapi({
      description:
        'Author name. Either a hardcoded `author` or the current `name` of the associated User.',
      example: 'Ethan',
    }),
    city: z.string().min(1).nullable().optional().openapi({
      description:
        'Current location city (reverse-geocoded from coordinates).',
      example: 'Boulder',
    }),
    state: z.string().min(1).nullable().optional().openapi({
      description:
        'Current location state (reverse-geocoded from coordinates).',
      example: 'Colorado',
    }),
    country: z.string().min(1).nullable().optional().openapi({
      description:
        'Current location county (reverse-geocoded from coordinates).',
      example: 'United States',
    }),
  }),
]).openapi({
  title: 'Location change',
})

// Users

export const BaseUser = register(
  'BaseUser',
  z
    .object({
      name: nameProp,
      bio: bioProp,
    })
    .openapi({ title: 'User (base)' }),
)

export const EditUser = allOf('EditUser', [
  BaseUser,
  z.object({
    email: emailProp,
    range: inlineAllOf([
      Polygon,
      z.object({}).openapi({ description: 'Foraging range.' }),
    ])
      .nullable()
      .openapi({ description: 'Foraging range.' }),
    announcements_email: z.boolean().openapi({
      description: 'Whether to receive the email newsletter.',
      example: true,
      default: true,
    }),
  }),
]).openapi({
  title: 'User (edit)',
  description: 'User properties that can be edited.',
})

export const PublicUser = allOf('PublicUser', [
  IdField,
  DateFields,
  BaseUser,
  z.object({
    roles: z
      .array(z.enum(['user', 'admin']))
      .openapi({
        description: 'Roles.\n- user: Regular user.\n- admin: Administrator.\n',
        example: ['user'],
      }),
    confirmed_at: z.string().datetime({ offset: true }).nullable().openapi({
      description:
        'Date and time confirmed in format YYYY-MM-DDThh:mm:ss.sssZ.',
      format: 'date-time',
      example: '2014-07-20T12:34:56.789Z',
    }),
  }),
]).openapi({
  title: 'User (public)',
})

export const User = allOf('User', [
  PublicUser,
  EditUser,
  z.object({
    unconfirmed_email: emailProp.optional().openapi({
      description: 'Email change pending confirmation.',
      example: 'noo@bar.com',
    }),
  }),
]).openapi({
  title: 'User',
})

// Reports

export const EditReport = register(
  'EditReport',
  z
    .object({
      location_id: z.number().int().min(1).openapi({
        description: 'Location ID.',
        example: 3383,
      }),
      problem_code: z
        .union([
          z.literal(0),
          z.literal(1),
          z.literal(2),
          z.literal(3),
          z.literal(4),
          z.literal(5),
        ])
        .openapi({
          description:
            'Problem code.\n- 0: Location is spam\n- 1: Location does not exist\n- 2: Location is a duplicate\n- 3: Inappropriate review photo\n- 4: Inappropriate review comment\n- 5: Other (explain below)\n',
          example: 1,
        }),
      comment: z.string().min(1).nullable().optional().openapi({
        description: 'Comment. Required if `problem_code` is 5.',
        example: 'This tree was cut down.',
      }),
      email: emailProp.optional().openapi({
        description:
          "Email to use for correspondence. If authenticated, defaults to the user's email. Otherwise, it is required.",
      }),
      name: z.string().min(1).nullable().optional().openapi({
        description:
          "Name to use for correspondence. If authenticated, defaults to the user's name.",
        example: 'Ethan',
      }),
    })
    .openapi({
      title: 'Report (edit)',
      description: 'Report properties that can be edited.',
    }),
)

export const Report = allOf('Report', [
  IdField,
  EditReport,
  DateFields,
  z.object({
    reporter_id: z.number().int().min(1).nullable().optional().openapi({
      description: 'ID of reporting User (if authenticated).',
      example: 321,
    }),
    resolution_code: z
      .union([
        z.literal(0),
        z.literal(1),
        z.literal(2),
        z.literal(3),
        z.literal(4),
        z.literal(5),
      ])
      .nullable()
      .optional()
      .openapi({
        description:
          'Resolution code.\n- 0: Made no changes\n- 1: Edited the location\n- 2: Deleted the location\n- 3: Deleted the photo\n- 4: Deleted the review\n- 5: Hid the location\n',
        example: 2,
      }),
    response: z.string().min(1).nullable().optional().openapi({
      description: 'Response comment.',
      example: 'Thank you for alerting us!',
    }),
    responder_id: z.number().int().min(1).nullable().optional().openapi({
      description: 'ID of responding User.',
    }),
  }),
]).openapi({
  title: 'Report',
  description: 'Report of a problem with a Location.',
})

// Token

export const Token = register(
  'Token',
  z
    .object({
      access_token: z.string().min(1).openapi({
        description: 'Access token.',
        example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',
      }),
      token_type: z.enum(['bearer']).openapi({
        description: 'Token type.',
        example: 'bearer',
      }),
      expires_in: z.number().int().min(1).openapi({
        description:
          'Seconds until the access token expires. It may expire earlier if revoked.',
        example: 900,
      }),
      refresh_token: z.string().min(1).openapi({
        description: 'Refresh token.',
        example: '6bFUlbCG3y1bl5dK6jmv5c45_2FGZchOJzZjvn5766A',
      }),
    })
    .openapi({ title: 'Token' }),
)

export type Cluster = z.infer<typeof Cluster>
export type TypeCount = z.infer<typeof TypeCount>
export type BaseType = z.infer<typeof BaseType>
export type SubmitType = z.infer<typeof SubmitType>
export type Type = z.infer<typeof Type>
export type ListLocation = z.infer<typeof ListLocation>
export type EditLocation = z.infer<typeof EditLocation>
export type AddLocation = z.infer<typeof AddLocation>
export type Location = z.infer<typeof Location>
export type LocationChange = z.infer<typeof LocationChange>
export type BaseReview = z.infer<typeof BaseReview>
export type EditReview = z.infer<typeof EditReview>
export type Review = z.infer<typeof Review>
export type Photo = z.infer<typeof Photo>
export type Import = z.infer<typeof Import>
export type EditLocationList = z.infer<typeof EditLocationList>
export type LocationListLocation = z.infer<typeof LocationListLocation>
export type LocationList = z.infer<typeof LocationList>
export type BaseUser = z.infer<typeof BaseUser>
export type EditUser = z.infer<typeof EditUser>
export type PublicUser = z.infer<typeof PublicUser>
export type User = z.infer<typeof User>
export type EditReport = z.infer<typeof EditReport>
export type Report = z.infer<typeof Report>
export type Token = z.infer<typeof Token>

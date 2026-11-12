import { z, register, intEnum } from './registry'

const EMAIL_PATTERN =
  "(?:[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*|\"(?:[\\x01-\\x08\\x0b\\x0c\\x0e-\\x1f\\x21\\x23-\\x5b\\x5d-\\x7f]|\\\\[\\x01-\\x09\\x0b\\x0c\\x0e-\\x7f])*\")@(?:(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?|\\[(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?|[a-z0-9-]*[a-z0-9]:(?:[\\x01-\\x08\\x0b\\x0c\\x0e-\\x1f\\x21-\\x5a\\x53-\\x7f]|\\\\[\\x01-\\x09\\x0b\\x0c\\x0e-\\x7f])+)\\])"

export { EMAIL_PATTERN }

export const emailProp = register(
  'email',
  z.string().regex(new RegExp(EMAIL_PATTERN)).openapi({
    description: 'Email.',
    format: 'email',
    example: 'foo@bar.com',
    pattern: EMAIL_PATTERN,
  }),
)

export const passwordProp = register(
  'password',
  z.string().min(6).openapi({
    description: 'Password.',
    format: 'password',
    example: 'f00!bar',
  }),
)

export const nameProp = register(
  'name',
  z.string().min(1).nullable().openapi({
    description: "Display name.",
    example: 'Ethan',
  }),
)

export const bioProp = register(
  'bio',
  z.string().min(1).nullable().openapi({
    description: "Bio ('about you').",
    example: 'Mulberries are my favorite fruit.',
  }),
)

export const PROBLEM_CODE_LABELS = [
  'Location is spam',
  'Location does not exist',
  'Location is a duplicate',
  'Inappropriate review photo',
  'Inappropriate review comment',
  'Other (explain below)',
] as const

export const RESOLUTION_CODE_LABELS = [
  'Made no changes',
  'Edited the location',
  'Deleted the location',
  'Deleted the photo',
  'Deleted the review',
  'Hid the location',
] as const

const codeListDescription = (prefix: string, labels: readonly string[]) =>
  `${prefix}\n${labels.map((label, code) => `- ${code}: ${label}`).join('\n')}\n`

export const problemCodeProp = register(
  'problem_code',
  intEnum([0, 1, 2, 3, 4, 5]).openapi({
    description: codeListDescription('Problem code.', PROBLEM_CODE_LABELS),
    example: 1,
  }),
)

export const resolutionCodeProp = register(
  'resolution_code',
  intEnum([0, 1, 2, 3, 4, 5]).openapi({
    description: codeListDescription(
      'Resolution code.',
      RESOLUTION_CODE_LABELS,
    ),
    example: 2,
  }),
)

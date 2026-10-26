import { z } from '../schemas/registry'

export class RequestValidationError extends Error {
  public readonly issues: z.core.$ZodIssue[]
  constructor(message: string, issues: z.core.$ZodIssue[]) {
    super(message)
    this.name = 'RequestValidationError'
    this.issues = issues
  }
}

export class ResponseValidationError extends Error {
  public readonly issues: z.core.$ZodIssue[]
  constructor(message: string, issues: z.core.$ZodIssue[]) {
    super(message)
    this.name = 'ResponseValidationError'
    this.issues = issues
  }
}

function formatIssues(issues: z.core.$ZodIssue[]): string {
  return issues
    .map((issue) => {
      const path = issue.path.join('.')
      return path ? `${path}: ${issue.message}` : issue.message
    })
    .join('; ')
}

export function validateRequestPart<T>(
  schema: z.ZodType<T>,
  value: unknown,
): T {
  const result = schema.safeParse(value)
  if (!result.success) {
    throw new RequestValidationError(
      formatIssues(result.error.issues),
      result.error.issues,
    )
  }
  return result.data
}

export function validateResponseBody<T>(
  schema: z.ZodType<T>,
  value: unknown,
): T {
  const result = schema.safeParse(value)
  if (!result.success) {
    throw new ResponseValidationError(
      formatIssues(result.error.issues),
      result.error.issues,
    )
  }
  return result.data
}

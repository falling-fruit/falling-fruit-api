import makeRouter from './makeRouter'
import type { Services } from './services'
import { z } from '../schemas/registry'
import {
  EditReport,
  Report,
  AdminReport,
  ResolvedReport,
  ReportBatchResolution,
  ReportResolutionResult,
} from '../schemas/schemas'
import type { ReportLocation } from '../mail/reportResolutionEmail'
import {
  recaptchaParam,
  notifyReportersParam,
  limitParam,
  offsetParam,
  reportSearchParam,
  reportProblemCodeParam,
  reportResolutionCodeParam,
  reportSortParam,
} from '../schemas/parameters'

export default function ({ db, middleware, auth, mailer }: Services) {
  const { router, get, post } = makeRouter()

  post(
    {
      path: '/reports',
      summary: 'Create a Report.',
      tags: ['Reports'],
      security: [{ key: [] }, { key: [], token: [] }],
      request: {
        headers: [recaptchaParam],
        body: { schema: EditReport, required: true },
      },
      responses: {
        '200': { description: 'Success', schema: Report },
      },
    },
    auth.optional,
    middleware.recaptcha,
    async (req, user) => {
      const report: typeof req.body & { reporter_id?: number } = {
        ...req.body,
      }
      if (user) {
        report.reporter_id = user.id
        if (!report.email || !report.name) {
          const dbUser = await db.users.show(user.id)
          report.email = report.email || dbUser.email
          report.name = report.name || dbUser.name
        }
      }
      if (!report.email) {
        throw Error('An email is required')
      }
      if (report.problem_code === 5 && !report.comment) {
        throw Error('comment is required when problem_code = 5')
      }
      return db.reports.add(report)
    },
  )

  get(
    {
      path: '/reports/open',
      summary: 'List open Reports.',
      description:
        'List all unresolved Reports of problems with Locations, with full ' +
        'details. Not paginated. Admin only.',
      tags: ['Reports'],
      security: [{ key: [], token: [] }],
      responses: {
        '200': { description: 'Success', schema: z.array(AdminReport) },
      },
    },
    auth.required_role('admin'),
    async () => db.reports.listOpen(),
  )

  get(
    {
      path: '/reports/resolved',
      summary: 'List resolved Reports.',
      description:
        'List resolved Reports of problems with Locations, with full details ' +
        'including how each was resolved. Supports free-text search, ' +
        'filtering by problem and resolution code, sorting by resolution ' +
        'date, and pagination. Admin only.',
      tags: ['Reports'],
      security: [{ key: [], token: [] }],
      request: {
        query: z.object({
          q: reportSearchParam,
          problem_code: reportProblemCodeParam,
          resolution_code: reportResolutionCodeParam,
          sort: reportSortParam,
          limit: limitParam,
          offset: offsetParam,
        }),
      },
      responses: {
        '200': { description: 'Success', schema: z.array(ResolvedReport) },
      },
    },
    auth.required_role('admin'),
    async (req) =>
      db.reports.listResolved({
        q: req.query.q,
        problem_code: req.query.problem_code,
        resolution_code: req.query.resolution_code,
        sort: req.query.sort,
        limit: req.query.limit,
        offset: req.query.offset,
      }),
  )

  post(
    {
      path: '/reports/resolution',
      summary: 'Resolve one or more Reports with an action.',
      description:
        'Resolve one or more Reports by applying a single action, transactionally. ' +
        'Admin only.\n\n' +
        'The action is discriminated by `code`:\n' +
        '- 0: Records the resolution only.\n' +
        '- 1: Records the resolution only; the admin edited the Location separately.\n' +
        '- 2: Deletes each distinct reported Location.\n' +
        '- 3: Deletes a photo (requires `photo_id`); its review must belong to the ' +
        'reported Location, so all Reports must target that single Location.\n' +
        '- 4: Deletes one or more reviews (requires `review_ids`); each must ' +
        'belong to the reported Location, so all Reports must target that single Location.\n' +
        '- 5: Hides each distinct reported Location.\n\n' +
        'If `notify_reporters` is true, each distinct reporter is emailed once ' +
        'about all of their resolved Reports. Sending is best-effort: a failed ' +
        'email does not roll back the resolution or stop other emails. The ' +
        'response reports which notifications were sent and which failed.',
      tags: ['Reports'],
      security: [{ key: [], token: [] }],
      request: {
        query: z.object({ notify_reporters: notifyReportersParam }),
        body: { schema: ReportBatchResolution, required: true },
      },
      responses: {
        '200': { description: 'Success', schema: ReportResolutionResult },
      },
    },
    auth.required_role('admin'),
    async (req, user) => {
      const { report_ids, resolution } = req.body
      const code = resolution.code
      const response = resolution.response ?? null

      const { resolved, reportLocations } = await db.tx(async (t) => {
          const reports = await t.reports.listByIds(report_ids)
          const reportLocations = new Map<number, ReportLocation>()
          for (const report of reports) {
            if (report.location_id !== null && report.location_id !== undefined) {
              reportLocations.set(report.id, { id: report.location_id })
            }
          }

          const foundIds = reports.map((r) => r.id)
          const missing = report_ids.filter((id) => !foundIds.includes(id))
          if (missing.length) {
            throw Error(`Report(s) ${missing.join(', ')} not found`)
          }
          const alreadyResolved = reports.filter(
            (r) => r.resolution_code !== null && r.resolution_code !== undefined,
          )
          if (alreadyResolved.length) {
            throw Error(
              `Report(s) ${alreadyResolved.map((r) => r.id).join(', ')} already resolved`,
            )
          }

          const locationIds = [
            ...new Set(
              reports
                .map((r) => r.location_id)
                .filter((id): id is number => id !== null && id !== undefined),
            ),
          ]

          const requireSingleLocation = (what: string): number => {
            if (locationIds.length !== 1) {
              throw Error(
                `${what} can only resolve Reports for a single Location (found ${locationIds.length})`,
              )
            }
            return locationIds[0]
          }

          if (resolution.code === 2) {
            for (const locationId of locationIds) {
              const old = await t.locations.show(locationId, null)
              for (const report of reports) {
                if (report.location_id === locationId) {
                  reportLocations.set(report.id, { deleted: old })
                }
              }
              await t.locations.delete(locationId)
              if (!old.hidden) {
                await t.clusters.decrement(old)
              }
            }
          } else if (resolution.code === 3) {
            const locationId = requireSingleLocation('Deleting a photo')
            const photoLocationId = await t.reports.photoLocationId(
              resolution.photo_id,
            )
            if (photoLocationId !== locationId) {
              throw Error(
                `Photo ${resolution.photo_id} does not belong to Location ${locationId}`,
              )
            }
            await t.photos.delete(resolution.photo_id)
          } else if (resolution.code === 4) {
            const locationId = requireSingleLocation('Deleting a review')
            const reviewLocationIds = await t.reports.reviewLocationIds(
              resolution.review_ids,
            )
            for (const [reviewId, reviewLocationId] of reviewLocationIds) {
              if (reviewLocationId !== locationId) {
                throw Error(
                  `Review ${reviewId} does not belong to Location ${locationId}`,
                )
              }
            }
            await t.reviews.deleteMany(resolution.review_ids)
          } else if (resolution.code === 5) {
            for (const locationId of locationIds) {
              const old = await t.locations.show(locationId, null)
              if (!old.hidden) {
                await t.locations.edit(
                  locationId,
                  {
                    lat: old.lat,
                    lng: old.lng,
                    type_ids: old.type_ids,
                    unverified: old.unverified,
                    access: old.access,
                    description: old.description,
                    season_start: old.season_start,
                    season_stop: old.season_stop,
                    hidden: true,
                  },
                  user,
                )
                await t.clusters.decrement(old)
              }
            }
          }

          const resolved = await t.reports.resolveMany(report_ids, {
            resolution_code: code,
            response,
            responder_id: user.id,
          })
          return { resolved, reportLocations }
      })

      const emails = { sent: [] as string[], failed: [] as { email: string; error: string }[] }
      if (req.query.notify_reporters) {
        const responder = await db.users.show(user.id)
        const responderName = responder.name ?? responder.email
        const byReporter = new Map<
          string,
          { email: string; name: string | null; reports: typeof resolved }
        >()
        for (const report of resolved) {
          if (!report.email) {
            continue
          }
          const existing = byReporter.get(report.email)
          if (existing) {
            existing.reports.push(report)
          } else {
            byReporter.set(report.email, {
              email: report.email,
              name: report.name ?? null,
              reports: [report],
            })
          }
        }
        for (const reporter of byReporter.values()) {
          try {
            await mailer.send_report_resolution({
              recipient: { email: reporter.email, name: reporter.name },
              resolution,
              responder: { name: responderName },
              reports: reporter.reports.map((report) => ({
                id: report.id,
                problem_code: report.problem_code,
                comment: report.comment ?? null,
              })),
              reportLocations,
            })
            emails.sent.push(reporter.email)
          } catch (error) {
            emails.failed.push({
              email: reporter.email,
              error: error instanceof Error ? error.message : String(error),
            })
          }
        }
      }

      return { resolved, emails }
    },
  )

  return router
}


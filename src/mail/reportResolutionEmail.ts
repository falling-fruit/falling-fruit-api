import EmailBody, { escapeHtml } from './EmailBody'
import type { MailUser } from './EmailBody'
import {
  PROBLEM_CODE_LABELS,
  RESOLUTION_CODE_LABELS,
} from '../schemas/properties'
import type { Location, ResolutionAction } from '../schemas/schemas'

export type ReportLocation = { id: number } | { deleted: Location }

type EnrichedReport = {
  location_id: number | null
  location_description: string | null
  problem_code: number | null
  comment: string | null
}

type ResolvedReport = {
  id: number
  problem_code: number | null
  comment?: string | null
}

export type ReportResolutionEmail = {
  recipient: MailUser
  resolution: ResolutionAction
  responder: { name: string }
  reports: ResolvedReport[]
  reportLocations: Map<number, ReportLocation>
}

const describeLocation = (location: Location): string => {
  const formatCoord = (value: number) => parseFloat(value.toFixed(6))
  const coords = `${formatCoord(location.lat)}, ${formatCoord(location.lng)}`
  const place = location.address ? `${coords} (${location.address})` : coords
  return `at ${place}`
}

const enrichReport = (
  report: ResolvedReport,
  reportLocations: Map<number, ReportLocation>,
): EnrichedReport => {
  const location = reportLocations.get(report.id)
  const description =
    location && 'deleted' in location
      ? describeLocation(location.deleted)
      : null
  return {
    location_id:
      location && 'id' in location ? location.id : null,
    location_description: description,
    problem_code: report.problem_code,
    comment: report.comment ?? null,
  }
}

const problemLabel = (problem_code: number | null) =>
  PROBLEM_CODE_LABELS[problem_code ?? 5] ?? PROBLEM_CODE_LABELS[5]

const problemText = (report: EnrichedReport) => {
  const comment = report.comment ? ` - <i>${escapeHtml(report.comment)}</i>` : ''
  return `${problemLabel(report.problem_code)}${comment}`
}

const locationRef = (
  webOrigin: string,
  report: EnrichedReport,
  fallback = 'that location',
) =>
  report.location_id === null
    ? report.location_description
      ? escapeHtml(report.location_description)
      : fallback
    : `<a href="${webOrigin}/locations/${report.location_id}">#${report.location_id}</a>`

const distinctLocationIds = (reports: EnrichedReport[]) => [
  ...new Set(
    reports
      .map((r) => r.location_id)
      .filter((id): id is number => id !== null && id !== undefined),
  ),
]

const reportResolutionSubject = (reports: EnrichedReport[]): string => {
  const ids = distinctLocationIds(reports)
  const allHaveId = reports.every(
    (r) => r.location_id !== null && r.location_id !== undefined,
  )
  if (allHaveId && ids.length === 1) {
    return `Falling Fruit Location #${ids[0]}`
  }
  if (allHaveId && ids.length <= 5) {
    return `Falling Fruit Locations ${ids.map((id) => `#${id}`).join(', ')}`
  }
  return `Falling Fruit problem report${reports.length === 1 ? '' : 's'}`
}

const singleProblemParagraph = (webOrigin: string, report: EnrichedReport) => {
  const forLocation =
    report.location_id === null && !report.location_description
      ? ''
      : ` for location ${locationRef(webOrigin, report)}`
  return (
    `Thank you for reporting a problem${forLocation}:<br/>` +
    `<br/>&emsp;&emsp;"${problemText(report)}"`
  )
}

const problemListItems = (webOrigin: string, reports: EnrichedReport[]) =>
  reports.map((report) => {
    const atLocation =
      report.location_id === null && !report.location_description
        ? ''
        : ` (location ${locationRef(webOrigin, report)})`
    return `"${problemText(report)}"${atLocation}`
  })

export const buildReportResolutionEmail = (
  webOrigin: string,
  {
    recipient,
    resolution,
    responder,
    reports,
    reportLocations,
  }: ReportResolutionEmail,
): { subject: string; body: string } => {
  const enriched = reports.map((report) =>
    enrichReport(report, reportLocations),
  )
  const body = new EmailBody()
  body.appendGreeting(recipient)
  if (enriched.length === 1) {
    body.appendParagraph(singleProblemParagraph(webOrigin, enriched[0]))
  } else {
    body.appendParagraph('Thank you for reporting the following problems:')
    body.appendList(problemListItems(webOrigin, enriched))
  }
  body.appendParagraph(
    `We have ${RESOLUTION_CODE_LABELS[resolution.code].toLowerCase()}.`,
  )
  if (resolution.response) {
    body.appendParagraph(escapeHtml(resolution.response))
  }
  body.appendClosingLine()
  body.appendSignature(responder.name)
  return { subject: reportResolutionSubject(enriched), body: body.build() }
}

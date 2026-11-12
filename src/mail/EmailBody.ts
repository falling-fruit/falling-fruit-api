export type MailUser = {
  email: string
  name?: string | null
}

export const escapeHtml = (text: string): string =>
  text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

class EmailBody {
  private readonly parts: string[] = []

  appendParagraph(text: string): void {
    this.parts.push(`<p>${text}</p>`)
  }

  appendMutedParagraph(text: string): void {
    this.parts.push(`<p style="color: #666;">${text}</p>`)
  }

  appendRule(): void {
    this.parts.push('<hr/>')
  }

  appendList(items: string[]): void {
    this.parts.push(
      `<ul>${items.map((item) => `<li>${item}</li>`).join('')}</ul>`,
    )
  }

  appendRaw(html: string): void {
    this.parts.push(html)
  }

  appendGreeting(user?: MailUser): void {
    const who = user ? user.name || user.email : ''
    this.appendParagraph(`Hello${who ? ` ${escapeHtml(who)}` : ''},`)
  }

  appendClosingLine(): void {
    this.appendRaw('Let us know if you have any questions or concerns.<br/>')
  }

  appendSignature(name: string): void {
    this.appendRaw(
      `thank you,<br/>${escapeHtml(name)}<br/>fallingfruit.org`,
    )
  }

  build(): string {
    return this.parts.join('\n')
  }
}

export default EmailBody

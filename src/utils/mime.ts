import {z} from 'zod';

const safeHeaderString = z.string().regex(/^[^\r\n]*$/, 'Must not contain newline characters');

export const attachmentSchema = z.object({
	filename: safeHeaderString.transform((s) => s.replaceAll('"', '')).describe('Attachment filename'),
	mimeType: safeHeaderString.describe('MIME type (e.g., application/pdf)'),
	content: z.string().describe('Base64-encoded file data'),
});

export type Attachment = z.output<typeof attachmentSchema>;

function uniqueBoundary(prefix: string): string {
	return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2)}`;
}

/**
 * Emit the body content (text, html, or multipart/alternative for both).
 */
function appendBodyPart(lines: string[], body: string, htmlBody?: string): void {
	const hasText = body !== undefined && body !== '';
	const hasHtml = htmlBody !== undefined && htmlBody !== '';

	if (hasText && hasHtml) {
		const altBoundary = uniqueBoundary('alt');
		lines.push(`Content-Type: multipart/alternative; boundary="${altBoundary}"`);
		lines.push('');
		lines.push(`--${altBoundary}`);
		lines.push('Content-Type: text/plain; charset=utf-8');
		lines.push('');
		lines.push(body);
		lines.push('');
		lines.push(`--${altBoundary}`);
		lines.push('Content-Type: text/html; charset=utf-8');
		lines.push('');
		lines.push(htmlBody!);
		lines.push('');
		lines.push(`--${altBoundary}--`);
	} else if (hasHtml) {
		lines.push('Content-Type: text/html; charset=utf-8');
		lines.push('');
		lines.push(htmlBody!);
	} else {
		lines.push('Content-Type: text/plain; charset=utf-8');
		lines.push('');
		lines.push(body);
	}
}

/**
 * Appends MIME body (plain text, HTML, or both via multipart/alternative) with
 * optional attachments to an array of RFC 2822 header lines.
 */
export function appendMimeBody(lines: string[], body: string, attachments?: Attachment[], htmlBody?: string): void {
	if (attachments && attachments.length > 0) {
		const boundary = uniqueBoundary('boundary');
		lines.push(`Content-Type: multipart/mixed; boundary="${boundary}"`);
		lines.push('');

		// Body part (text, html, or alternative)
		lines.push(`--${boundary}`);
		appendBodyPart(lines, body, htmlBody);
		lines.push('');

		// Attachment parts
		for (const attachment of attachments) {
			lines.push(`--${boundary}`);
			lines.push(`Content-Type: ${attachment.mimeType}`);
			lines.push('Content-Transfer-Encoding: base64');
			lines.push(`Content-Disposition: attachment; filename="${attachment.filename}"`);
			lines.push('');
			lines.push(attachment.content);
			lines.push('');
		}

		lines.push(`--${boundary}--`);
	} else {
		appendBodyPart(lines, body, htmlBody);
	}
}

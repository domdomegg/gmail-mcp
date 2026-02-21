import {z} from 'zod';

const safeHeaderString = z.string().regex(/^[^\r\n]*$/, 'Must not contain newline characters');

export const attachmentSchema = z.object({
	filename: safeHeaderString.transform(s => s.replaceAll('"', '')).describe('Attachment filename'),
	mimeType: safeHeaderString.describe('MIME type (e.g., application/pdf)'),
	content: z.string().describe('Base64-encoded file data'),
});

export type Attachment = z.output<typeof attachmentSchema>;

/**
 * Appends MIME multipart body with attachments to an array of RFC 2822 header lines.
 * If no attachments, appends a plain text body.
 */
export function appendMimeBody(lines: string[], body: string, attachments?: Attachment[]): void {
	if (attachments && attachments.length > 0) {
		const boundary = `boundary_${Date.now()}_${Math.random().toString(36).substring(2)}`;
		lines.push(`Content-Type: multipart/mixed; boundary="${boundary}"`);
		lines.push('');

		// Text body part
		lines.push(`--${boundary}`);
		lines.push('Content-Type: text/plain; charset=utf-8');
		lines.push('');
		lines.push(body);
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
		lines.push('Content-Type: text/plain; charset=utf-8');
		lines.push('');
		lines.push(body);
	}
}

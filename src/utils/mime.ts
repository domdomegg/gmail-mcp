import {z} from 'zod';

const safeHeaderString = z.string().regex(/^[^\r\n]*$/, 'Must not contain newline characters');

function isAscii(value: string): boolean {
	for (let i = 0; i < value.length; i++) {
		if (value.charCodeAt(i) > 0x7f) {
			return false;
		}
	}

	return true;
}

/**
 * Encode a header value as RFC 2047 "encoded-words" when it contains non-ASCII
 * characters (e.g. Subject lines with å/ä/ö or em-dashes). ASCII-only values are
 * returned unchanged so plain headers stay human-readable.
 *
 * The value is UTF-8 base64 encoded and split into multiple encoded-words, each
 * kept within the 75-character limit (RFC 2047 §2) and joined by a single space
 * on one line. Splitting happens on whole Unicode code points so multi-byte
 * characters are never broken across words.
 */
export function encodeHeaderValue(value: string): string {
	if (isAscii(value)) {
		return value;
	}

	const prefix = '=?UTF-8?B?';
	const suffix = '?=';
	// base64 grows in groups of 4 chars per 3 bytes; keep whole groups within the
	// 75-char encoded-word budget.
	const maxBytesPerWord = Math.floor((75 - prefix.length - suffix.length) / 4) * 3;

	const words: string[] = [];
	let chunk = Buffer.alloc(0);
	for (const char of value) {
		const charBytes = Buffer.from(char, 'utf-8');
		if (chunk.length > 0 && chunk.length + charBytes.length > maxBytesPerWord) {
			words.push(prefix + chunk.toString('base64') + suffix);
			chunk = charBytes;
		} else {
			chunk = Buffer.concat([chunk, charBytes]);
		}
	}

	if (chunk.length > 0) {
		words.push(prefix + chunk.toString('base64') + suffix);
	}

	return words.join(' ');
}

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
		lines.push(htmlBody);
		lines.push('');
		lines.push(`--${altBoundary}--`);
	} else if (hasHtml) {
		lines.push('Content-Type: text/html; charset=utf-8');
		lines.push('');
		lines.push(htmlBody);
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

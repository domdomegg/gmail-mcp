import {z} from 'zod';

const safeHeaderString = z.string().regex(/^[^\r\n]*$/, 'Must not contain newline characters');

export const attachmentSchema = z.object({
	filename: safeHeaderString.transform((s) => s.replaceAll('"', '')).describe('Attachment filename'),
	mimeType: safeHeaderString.describe('MIME type (e.g., application/pdf)'),
	content: z.string().describe('Base64-encoded file data'),
});

export type Attachment = z.output<typeof attachmentSchema>;

/**
 * RFC 2047 encoding for header values (e.g. Subject). Headers must be ASCII;
 * raw UTF-8 gets mojibaked by Gmail (an em dash becomes "â€”"). Values that
 * are already ASCII pass through untouched.
 */
export function encodeHeaderValue(value: string): string {
	if (/^[\x20-\x7e]*$/.test(value)) {
		return value;
	}

	// Each encoded word must stay within 75 chars and contain whole
	// characters, so chunk the string by UTF-8 byte length.
	const chunks: string[] = [];
	let chunk = '';
	for (const char of value) {
		if (Buffer.byteLength(chunk + char, 'utf-8') > 45) {
			chunks.push(chunk);
			chunk = '';
		}

		chunk += char;
	}

	chunks.push(chunk);
	return chunks.map((c) => `=?UTF-8?B?${Buffer.from(c, 'utf-8').toString('base64')}?=`).join('\r\n ');
}

/**
 * Quoted-printable encoding (RFC 2045) with soft line breaks. Without a
 * Content-Transfer-Encoding, Gmail hard-wraps long lines at ~72 chars when it
 * ingests a raw message — mid-paragraph breaks the author never wrote.
 * Soft breaks (`=\r\n`) disappear on decode, so paragraphs survive intact.
 */
export function quotedPrintableEncode(text: string): string {
	const bytes = Buffer.from(text.replace(/\r?\n/g, '\r\n'), 'utf-8');
	const lines: string[] = [];
	let line = '';
	for (let i = 0; i < bytes.length; i++) {
		const byte = bytes[i]!;
		if (byte === 0x0d && bytes[i + 1] === 0x0a) {
			lines.push(line);
			line = '';
			i += 1;
			continue;
		}

		const literal = byte !== 0x3d && byte >= 0x20 && byte <= 0x7e;
		const token = literal ? String.fromCharCode(byte) : `=${byte.toString(16).toUpperCase().padStart(2, '0')}`;
		if (line.length + token.length > 73) {
			lines.push(`${line}=`); // soft break
			line = '';
		}

		line += token;
	}

	lines.push(line);
	// Trailing whitespace on a line must be encoded.
	return lines.map((l) => l.replace(/ $/, '=20').replace(/\t$/, '=09')).join('\r\n');
}

/**
 * Appends MIME multipart body with attachments to an array of RFC 2822 header lines.
 * If no attachments, appends a plain text body.
 */
export function appendMimeBody(lines: string[], body: string, attachments?: Attachment[]): void {
	lines.push('MIME-Version: 1.0');
	if (attachments && attachments.length > 0) {
		const boundary = `boundary_${Date.now()}_${Math.random().toString(36).substring(2)}`;
		lines.push(`Content-Type: multipart/mixed; boundary="${boundary}"`);
		lines.push('');

		// Text body part
		lines.push(`--${boundary}`);
		lines.push('Content-Type: text/plain; charset=utf-8');
		lines.push('Content-Transfer-Encoding: quoted-printable');
		lines.push('');
		lines.push(quotedPrintableEncode(body));
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
		lines.push('Content-Transfer-Encoding: quoted-printable');
		lines.push('');
		lines.push(quotedPrintableEncode(body));
	}
}

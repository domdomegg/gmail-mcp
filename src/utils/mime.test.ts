import {describe, it, expect} from 'vitest';
import {appendMimeBody, encodeHeaderValue, quotedPrintableEncode} from './mime.js';

/** Reference decoder: soft breaks removed, =XX sequences to bytes. */
const qpDecode = (encoded: string): string => {
	const bytes: number[] = [];
	const text = encoded.replace(/=\r\n/g, '');
	for (let i = 0; i < text.length; i++) {
		if (text[i] === '=' && /[0-9A-F]{2}/.test(text.slice(i + 1, i + 3))) {
			bytes.push(Number.parseInt(text.slice(i + 1, i + 3), 16));
			i += 2;
		} else {
			bytes.push(text.codePointAt(i)!);
		}
	}

	return Buffer.from(bytes).toString('utf-8');
};

describe('encodeHeaderValue', () => {
	it('passes ASCII through untouched', () => {
		expect(encodeHeaderValue('Plain subject, nothing fancy!')).toBe('Plain subject, nothing fancy!');
	});

	it('encodes non-ASCII as RFC 2047 words that decode back', () => {
		const value = 'AdamCon ’26: book your one-to-one conversations — now';
		const encoded = encodeHeaderValue(value);
		expect(encoded).toMatch(/^=\?UTF-8\?B\?[A-Za-z0-9+/=]+\?=(\r\n =\?UTF-8\?B\?[A-Za-z0-9+/=]+\?=)*$/);
		const decoded = encoded.split(/\r\n /).map((word) => {
			const b64 = /^=\?UTF-8\?B\?([A-Za-z0-9+/=]+)\?=$/.exec(word)![1]!;
			return Buffer.from(b64, 'base64').toString('utf-8');
		}).join('');
		expect(decoded).toBe(value);
	});

	it('keeps every encoded word within 75 chars', () => {
		const encoded = encodeHeaderValue('é'.repeat(200));
		for (const word of encoded.split(/\r\n /)) {
			expect(word.length).toBeLessThanOrEqual(75);
		}
	});
});

describe('quotedPrintableEncode', () => {
	const longParagraph = 'The AdamCon one-to-one booking app is now live. Everyone coming on Sat 1 Aug has a profile — you can browse who else is coming, and book 25-minute one-to-one conversations into your schedule for the day.';

	it('round-trips text unchanged', () => {
		const text = `Hi there,\n\n${longParagraph}\n\nSee you = soon!\nAdam`;
		expect(qpDecode(quotedPrintableEncode(text))).toBe(text.replace(/\n/g, '\r\n'));
	});

	it('keeps every line within 76 chars (soft breaks, not hard wraps)', () => {
		const encoded = quotedPrintableEncode(longParagraph);
		for (const line of encoded.split('\r\n')) {
			expect(line.length).toBeLessThanOrEqual(76);
		}

		// The original paragraph had no newlines, so every break must be soft.
		expect(qpDecode(encoded)).toBe(longParagraph);
	});

	it('encodes trailing whitespace', () => {
		expect(quotedPrintableEncode('line with trailing space \nnext')).toBe('line with trailing space=20\r\nnext');
	});
});

describe('appendMimeBody', () => {
	it('declares MIME-Version and quoted-printable without attachments', () => {
		const lines: string[] = [];
		appendMimeBody(lines, 'Hello — world');
		const message = lines.join('\r\n');
		expect(message).toContain('MIME-Version: 1.0');
		expect(message).toContain('Content-Type: text/plain; charset=utf-8');
		expect(message).toContain('Content-Transfer-Encoding: quoted-printable');
		expect(message).toContain(quotedPrintableEncode('Hello — world'));
	});

	it('declares quoted-printable on the text part with attachments', () => {
		const lines: string[] = [];
		appendMimeBody(lines, 'Hello', [{filename: 'a.txt', mimeType: 'text/plain', content: 'aGk='}]);
		const message = lines.join('\r\n');
		expect(message).toContain('MIME-Version: 1.0');
		expect(message).toContain('Content-Type: multipart/mixed');
		expect(message).toContain('Content-Transfer-Encoding: quoted-printable');
	});

	it('sends multipart/alternative with both bodies, plain text first', () => {
		const lines: string[] = [];
		appendMimeBody(lines, 'Hello — world', undefined, '<p>Hello &mdash; world</p>');
		const message = lines.join('\r\n');

		const boundary = /boundary="(alt_[^"]+)"/.exec(message)![1]!;
		expect(message).toContain('Content-Type: multipart/alternative;');
		expect(message.indexOf('text/plain')).toBeLessThan(message.indexOf('text/html'));
		expect(message).toContain(quotedPrintableEncode('Hello — world'));
		expect(message).toContain(quotedPrintableEncode('<p>Hello &mdash; world</p>'));
		expect(message).toContain(`--${boundary}--`);

		// Both parts stay quoted-printable, so neither gets hard-wrapped.
		expect(message.match(/Content-Transfer-Encoding: quoted-printable/g)).toHaveLength(2);
	});

	it('sends text/html alone when only htmlBody is given', () => {
		const lines: string[] = [];
		appendMimeBody(lines, '', undefined, '<p>Hi</p>');
		const message = lines.join('\r\n');
		expect(message).toContain('Content-Type: text/html; charset=utf-8');
		expect(message).not.toContain('multipart/alternative');
		expect(message).not.toContain('text/plain');
	});

	it('nests the alternative inside multipart/mixed when attachments are present', () => {
		const lines: string[] = [];
		appendMimeBody(lines, 'Hello', [{filename: 'a.txt', mimeType: 'text/plain', content: 'aGk='}], '<p>Hello</p>');
		const message = lines.join('\r\n');

		const mixed = /boundary="(boundary_[^"]+)"/.exec(message)![1]!;
		const alt = /boundary="(alt_[^"]+)"/.exec(message)![1]!;
		expect(message.indexOf(`--${alt}--`)).toBeLessThan(message.indexOf('Content-Disposition: attachment'));
		expect(message.trimEnd().endsWith(`--${mixed}--`)).toBe(true);
	});

	it('stays plain text when htmlBody is absent or empty', () => {
		for (const html of [undefined, '']) {
			const lines: string[] = [];
			appendMimeBody(lines, 'Hello', undefined, html);
			const message = lines.join('\r\n');
			expect(message).toContain('Content-Type: text/plain; charset=utf-8');
			expect(message).not.toContain('multipart/alternative');
		}
	});
});

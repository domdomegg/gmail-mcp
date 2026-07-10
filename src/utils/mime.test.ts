import {describe, it, expect} from 'vitest';
import {encodeHeaderValue} from './mime.js';

/** Minimal RFC 2047 decoder for round-trip assertions in tests. */
function decodeEncodedWords(value: string): string {
	return value
		.split(' ')
		.map((word) => {
			const match = /^=\?UTF-8\?B\?(.*)\?=$/.exec(word);
			return match ? Buffer.from(match[1], 'base64').toString('utf-8') : word;
		})
		.join('');
}

describe('encodeHeaderValue', () => {
	it('returns ASCII-only values unchanged', () => {
		expect(encodeHeaderValue('Plain ASCII subject')).toBe('Plain ASCII subject');
		expect(encodeHeaderValue('')).toBe('');
	});

	it('encodes non-ASCII values as RFC 2047 encoded-words', () => {
		const encoded = encodeHeaderValue('Ponty MCP (read-only) – så kommer du igång');
		expect(encoded).toMatch(/^=\?UTF-8\?B\?/);
		expect(decodeEncodedWords(encoded)).toBe('Ponty MCP (read-only) – så kommer du igång');
	});

	it('keeps every encoded-word within the 75-character limit', () => {
		const longSubject = 'Påminnelse om förändringar i avtalet för räkenskapsåret – återkoppling önskas snarast';
		const encoded = encodeHeaderValue(longSubject);
		for (const word of encoded.split(' ')) {
			expect(word.length).toBeLessThanOrEqual(75);
		}

		expect(decodeEncodedWords(encoded)).toBe(longSubject);
	});

	it('never splits a multi-byte character across encoded-words', () => {
		// Emoji are 4 UTF-8 bytes / surrogate pairs; round-trip must stay intact.
		const subject = 'Status 🚀 åäö 🎉 klart';
		expect(decodeEncodedWords(encodeHeaderValue(subject))).toBe(subject);
	});
});

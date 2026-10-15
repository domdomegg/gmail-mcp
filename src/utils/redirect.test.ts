import {describe, expect, test} from 'vitest';
import {isAllowedRedirectUri, parseAllowedRedirects} from './redirect.js';

describe('isAllowedRedirectUri', () => {
	test.each([
		'http://localhost:54321/callback',
		'http://127.0.0.1:8080/cb',
		'http://[::1]:9000/callback',
		'https://claude.ai/api/mcp/auth_callback',
	])('allows %s', (uri) => {
		expect(isAllowedRedirectUri(uri)).toBe(true);
	});

	test.each([
		'',
		'not a url',
		'https://attacker.example/',
		'https://localhost/callback',
		'http://localhost.attacker.example/callback',
		'http://user@localhost:1/callback',
		'https://claude.ai/api/mcp/auth_callback/../evil',
		'https://claude.ai.attacker.example/api/mcp/auth_callback',
		'data:text/html,x',
	])('rejects %s', (uri) => {
		expect(isAllowedRedirectUri(uri)).toBe(false);
	});

	test('allows extra configured URIs exactly', () => {
		expect(isAllowedRedirectUri('https://example.com/cb', ['https://example.com/cb'])).toBe(true);
		expect(isAllowedRedirectUri('https://example.com/cb2', ['https://example.com/cb'])).toBe(false);
	});
});

test('parseAllowedRedirects', () => {
	expect(parseAllowedRedirects(' https://a/cb , ,https://b/cb')).toEqual(['https://a/cb', 'https://b/cb']);
	expect(parseAllowedRedirects(undefined)).toEqual([]);
});

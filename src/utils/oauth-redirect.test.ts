import {describe, it, expect} from 'vitest';
import {
	buildClientRedirect, checkRedirectUri, parseAllowedRedirectUris, renderConsentPage,
} from './oauth-redirect.js';

const allowed = parseAllowedRedirectUris('https://claude.ai/api/mcp/auth_callback, https://mcp.example.com/upstream-auth/callback, https://other.example/cb');

describe('checkRedirectUri', () => {
	it.each([
		'http://localhost:33418/callback',
		'http://127.0.0.1:8080/oauth/callback',
		'http://[::1]:9000/cb',
		'cursor://anysphere.cursor-retrieval/oauth/callback',
		'https://claude.ai/api/mcp/auth_callback',
		'https://claude.ai/api/mcp/auth_callback?foo=bar',
		'https://mcp.example.com/upstream-auth/callback',
		'https://other.example/cb',
	])('allows %s', (uri) => {
		expect(checkRedirectUri(uri, allowed)).toBe('allowed');
	});

	it.each([
		'https://attacker.example/cb',
		'https://claude.ai.attacker.example/api/mcp/auth_callback',
		'https://claude.ai/api/mcp/other',
		'https://localhost.attacker.example/cb',
		'http://mcp.example.com/upstream-auth/callback',
	])('requires consent for %s', (uri) => {
		expect(checkRedirectUri(uri, allowed)).toBe('needs_consent');
	});

	it.each([
		'',
		'not a url',
		// eslint-disable-next-line no-script-url
		'javascript:alert(1)',
		'data:text/html,hi',
		'file:///etc/passwd',
		'http://localhost:3000/cb#frag',
	])('rejects %s', (uri) => {
		expect(checkRedirectUri(uri, allowed)).toBe('invalid');
	});

	it('trusts well-known hosted clients by default', () => {
		expect(checkRedirectUri('https://claude.ai/api/mcp/auth_callback', parseAllowedRedirectUris(undefined))).toBe('allowed');
		expect(checkRedirectUri('https://chatgpt.com/connector/oauth/abc123', parseAllowedRedirectUris(undefined))).toBe('allowed');
		expect(checkRedirectUri('https://vscode.dev/redirect', parseAllowedRedirectUris(undefined))).toBe('needs_consent');
		expect(checkRedirectUri('https://chatgpt.com/other', parseAllowedRedirectUris(undefined))).toBe('needs_consent');
		expect(checkRedirectUri('https://other.example/cb', parseAllowedRedirectUris(undefined))).toBe('needs_consent');
	});

	it('supports trailing wildcards', () => {
		expect(checkRedirectUri('https://a.example/cb/123', parseAllowedRedirectUris('https://a.example/cb/*'))).toBe('allowed');
		expect(checkRedirectUri('https://a.example/other', parseAllowedRedirectUris('https://a.example/cb/*'))).toBe('needs_consent');
	});

	it('lets ALLOWED_REDIRECT_URIS replace the defaults', () => {
		expect(checkRedirectUri('https://claude.ai/api/mcp/auth_callback', parseAllowedRedirectUris('https://other.example/cb'))).toBe('needs_consent');
		expect(checkRedirectUri('https://claude.ai/api/mcp/auth_callback', parseAllowedRedirectUris(''))).toBe('needs_consent');
		expect(checkRedirectUri('http://localhost:1/cb', parseAllowedRedirectUris(''))).toBe('allowed');
	});
});

describe('buildClientRedirect', () => {
	it('preserves existing query params and skips empty values', () => {
		expect(buildClientRedirect('http://localhost:1/cb?x=1', {code: 'abc', state: '', error: ''}))
			.toBe('http://localhost:1/cb?x=1&code=abc');
	});
});

describe('renderConsentPage', () => {
	it('escapes untrusted values', () => {
		const html = renderConsentPage({
			serverName: 'Test',
			redirectUri: 'https://evil.example/cb?"><script>alert(1)</script>',
			hiddenFields: {state: '"><script>'},
		});
		expect(html).not.toContain('<script>');
		expect(html).toContain('evil.example');
	});
});

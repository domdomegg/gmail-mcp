/**
 * Whoever receives a code from /callback can redeem it at /token, so only forward codes to
 * redirect URIs a remote attacker can't receive; ask the user to confirm anything else.
 * Checked in /callback, as an attacker can craft the state themselves.
 */

// A trailing * matches any suffix
const DEFAULT_ALLOWED_REDIRECT_URIS = [
	'https://claude.ai/api/mcp/auth_callback',
	'https://claude.com/api/mcp/auth_callback',
	'https://chatgpt.com/connector_platform_oauth_redirect',
	'https://chatgpt.com/connector/oauth/*',
	'https://www.cursor.com/agents/mcp/oauth/callback',
];

const LOOPBACK_HOSTNAMES = new Set(['localhost', '127.0.0.1', '[::1]']);

// eslint-disable-next-line no-script-url
const BLOCKED_SCHEMES = new Set(['javascript:', 'data:', 'file:', 'blob:', 'about:', 'vbscript:', 'filesystem:']);

export type RedirectUriVerdict = 'allowed' | 'needs_consent' | 'invalid';

// Replaces the defaults if set
export function parseAllowedRedirectUris(env: string | undefined): string[] {
	if (env === undefined) {
		return DEFAULT_ALLOWED_REDIRECT_URIS;
	}

	return env.split(',').map((uri) => uri.trim()).filter(Boolean);
}

export function checkRedirectUri(redirectUri: string, allowedRedirectUris: string[]): RedirectUriVerdict {
	let url: URL;
	try {
		url = new URL(redirectUri);
	} catch {
		return 'invalid';
	}

	if (BLOCKED_SCHEMES.has(url.protocol) || url.hash) {
		return 'invalid';
	}

	// Native app schemes and loopback only reach the user's own machine
	if ((url.protocol !== 'http:' && url.protocol !== 'https:') || LOOPBACK_HOSTNAMES.has(url.hostname)) {
		return 'allowed';
	}

	const target = `${url.origin}${url.pathname}`;
	const isAllowed = allowedRedirectUris.some((allowed) => (allowed.endsWith('*') ? target.startsWith(allowed.slice(0, -1)) : target === allowed));
	return isAllowed ? 'allowed' : 'needs_consent';
}

export function buildClientRedirect(redirectUri: string, params: Record<string, string>): string {
	const url = new URL(redirectUri);
	for (const [key, value] of Object.entries(params)) {
		if (value) {
			url.searchParams.set(key, value);
		}
	}

	return url.toString();
}

function escapeHtml(s: string): string {
	return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

export function renderConsentPage(opts: {
	serverName: string;
	redirectUri: string;
	hiddenFields: Record<string, string>;
}): string {
	const {host} = new URL(opts.redirectUri);
	const fields = Object.entries(opts.hiddenFields)
		.map(([name, value]) => `<input type="hidden" name="${escapeHtml(name)}" value="${escapeHtml(value)}">`)
		.join('');

	return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Confirm access</title>
<style>
  @media (prefers-color-scheme: light) { :root { --bg: #fafafa; --fg: #111; --muted: #888; --subtle: #999; --btn-bg: #111; --btn-fg: #fafafa; --btn-hover: #333; } }
  @media (prefers-color-scheme: dark) { :root { --bg: #161616; --fg: #e5e5e5; --muted: #777; --subtle: #666; --btn-bg: #e5e5e5; --btn-fg: #161616; --btn-hover: #ccc; } }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', 'Consolas', monospace; padding: 48px 24px; max-width: 520px; margin: 0 auto; background: var(--bg); color: var(--fg); }
  h1 { font-size: 14px; text-transform: uppercase; letter-spacing: 2px; font-weight: 700; margin-bottom: 8px; color: var(--muted); }
  .msg { font-size: 13px; color: var(--subtle); margin-bottom: 28px; }
  strong { color: var(--fg); }
  button { display: inline-block; font: inherit; font-size: 12px; font-weight: 600; padding: 8px 20px; border-radius: 4px; border: none; cursor: pointer; background: var(--btn-bg); color: var(--btn-fg); }
  button:hover { background: var(--btn-hover); }
</style>
</head>
<body>
<h1>${escapeHtml(opts.serverName)}</h1>
<p class="msg">This will give <strong>${escapeHtml(host)}</strong> access to your Google account.</p>
<p class="msg">Only continue if you started this sign-in yourself and you recognise this address. If someone sent you a link, close this page.</p>
<form method="post" action="callback">
${fields}
<button type="submit" name="decision" value="approve">continue to ${escapeHtml(host)}</button>
</form>
</body></html>`;
}

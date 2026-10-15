const DEFAULT_REMOTE_REDIRECTS = ['https://claude.ai/api/mcp/auth_callback'];

// Loopback on any port (RFC 8252 §7.3), plus an explicit list for hosted clients.
export function isAllowedRedirectUri(uri: string, extra: string[] = []): boolean {
	let url: URL;
	try {
		url = new URL(uri);
	} catch {
		return false;
	}

	if (url.username || url.password || url.hash) {
		return false;
	}

	if (url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) {
		return true;
	}

	return [...DEFAULT_REMOTE_REDIRECTS, ...extra].includes(uri);
}

export function parseAllowedRedirects(value: string | undefined): string[] {
	return (value ?? '').split(',').map((s) => s.trim()).filter(Boolean);
}

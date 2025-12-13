/**
 * Token validation cache with TTL+LRU eviction.
 *
 * Google access tokens are opaque (not JWTs), so we must call tokeninfo to check validity.
 * We cache the actual expiry time from Google, plus a buffer for recently-expired tokens.
 *
 * Why validate upfront instead of bubbling up 401s from tool handlers?
 * The MCP SDK wraps all tool errors in JSON-RPC responses with HTTP 200, so clients never
 * see HTTP 401 and don't trigger token refresh. MCP clients rely on HTTP 401 to know when
 * to use their refresh token to get a new access token. By validating upfront, we can
 * return HTTP 401 before the request reaches the SDK, allowing the client to refresh and retry.
 *
 * See: https://github.com/modelcontextprotocol/typescript-sdk/issues/1294
 */

const TOKEN_CACHE_MAX_SIZE = 100;
const TOKEN_CACHE_EXPIRED_BUFFER_MS = 5 * 60 * 1000; // Keep expired tokens cached for 5 min

const tokenCache = new Map<string, number>(); // token -> expiresAt timestamp

function tokenCacheSet(token: string, expiresAt: number): void {
	// LRU eviction: delete oldest entries if at capacity
	if (tokenCache.size >= TOKEN_CACHE_MAX_SIZE) {
		const firstKey = tokenCache.keys().next().value;
		if (firstKey) {
			tokenCache.delete(firstKey);
		}
	}

	tokenCache.set(token, expiresAt);
}

function tokenCacheGet(token: string): number | undefined {
	const expiresAt = tokenCache.get(token);
	if (expiresAt === undefined) {
		return undefined;
	}

	// LRU: move to end by re-inserting
	tokenCache.delete(token);
	tokenCache.set(token, expiresAt);

	return expiresAt;
}

export async function isTokenValid(token: string): Promise<boolean> {
	const cachedExpiresAt = tokenCacheGet(token);
	if (cachedExpiresAt !== undefined) {
		// Cache hit - check if token is still valid
		return cachedExpiresAt > Date.now();
	}

	// Cache miss - call tokeninfo
	try {
		const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?access_token=${token}`);
		if (!response.ok) {
			// Invalid token - cache as expired so we don't keep hitting tokeninfo
			tokenCacheSet(token, Date.now() - TOKEN_CACHE_EXPIRED_BUFFER_MS);
			return false;
		}

		const data = await response.json() as {expires_in?: number};
		const expiresIn = data.expires_in ?? 0;
		const expiresAt = Date.now() + (expiresIn * 1000);
		tokenCacheSet(token, expiresAt);
		return expiresAt > Date.now();
	} catch {
		return false;
	}
}

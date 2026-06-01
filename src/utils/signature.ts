import {makeGmailApiCall} from './gmail-api.js';

type SendAs = {
	sendAsEmail?: string;
	signature?: string;
	isPrimary?: boolean;
	isDefault?: boolean;
};

export type Signature = {html: string; text: string};

const EMPTY: Signature = {html: '', text: ''};

/** Extract a bare email address from a "Name <email>" string (or return as-is). */
function extractEmail(address: string): string {
	const match = /<([^>]+)>/.exec(address);
	const email = match?.[1] ?? address;
	return email.trim().toLowerCase();
}

/** Convert a Gmail HTML signature into a reasonable plain-text equivalent. */
export function htmlToText(html: string): string {
	return html
		.replace(/<\s*br\s*\/?>/gi, '\n')
		.replace(/<\/\s*(?:p|div|tr|h[1-6])\s*>/gi, '\n')
		.replace(/<[^>]+>/g, '')
		.replace(/&nbsp;/gi, ' ')
		.replace(/&amp;/gi, '&')
		.replace(/&lt;/gi, '<')
		.replace(/&gt;/gi, '>')
		.replace(/&#0?39;/gi, '\'')
		.replace(/&quot;/gi, '"')
		.replace(/\n{3,}/g, '\n\n')
		.trim();
}

/**
 * Pick the signature for the given from-address (matched on send-as email),
 * falling back to the default/primary send-as. Returns an empty signature when
 * none is configured.
 */
export function selectSignature(sendAs: SendAs[], from?: string): Signature {
	if (sendAs.length === 0) {
		return EMPTY;
	}

	const wanted = from ? extractEmail(from) : undefined;
	const byFrom = wanted ? sendAs.find((s) => s.sendAsEmail?.toLowerCase() === wanted) : undefined;
	const fallback = sendAs.find((s) => s.isDefault) ?? sendAs.find((s) => s.isPrimary) ?? sendAs[0];
	const html = (byFrom ?? fallback)?.signature?.trim() ?? '';

	return html ? {html, text: htmlToText(html)} : EMPTY;
}

/**
 * Fetch the stored Gmail send-as signature. Gmail never auto-applies signatures
 * to messages created through the API, so callers append it themselves. Returns
 * an empty signature when none is set or the lookup fails — a missing signature
 * must never break sending. Readable with the gmail.readonly scope.
 */
export async function getSignature(token: string, from?: string): Promise<Signature> {
	try {
		const response = await makeGmailApiCall('GET', '/users/me/settings/sendAs', token) as {sendAs?: SendAs[]};
		return selectSignature(response.sendAs ?? [], from);
	} catch {
		return EMPTY;
	}
}

/**
 * Append the signature to whichever bodies are present (plain text and/or HTML).
 * No-op when the signature is empty.
 */
export function applySignature(
	parts: {body?: string; htmlBody?: string},
	signature: Signature,
): {body?: string; htmlBody?: string} {
	if (!signature.html) {
		return parts;
	}

	const result: {body?: string; htmlBody?: string} = {...parts};
	if (parts.htmlBody !== undefined && parts.htmlBody !== '') {
		result.htmlBody = `${parts.htmlBody}<br><br>${signature.html}`;
	}

	if (parts.body !== undefined && parts.body !== '') {
		result.body = `${parts.body}\n\n${signature.text}`;
	}

	return result;
}

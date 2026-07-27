import {z} from 'zod';
import type {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import type {Config} from './types.js';
import {makeGmailApiCall} from '../utils/gmail-api.js';
import {jsonResult} from '../utils/response.js';
import {strictSchemaWithAliases} from '../utils/schema.js';
import {appendMimeBody, attachmentSchema, encodeHeaderValue} from '../utils/mime.js';

const inputSchema = strictSchemaWithAliases({
	draftId: z.string().describe('The ID of the draft to update'),
	threadId: z.string().optional().describe('Thread to keep the draft in. Defaults to the draft\'s current thread, so reply drafts stay in their conversation.'),
	to: z.string().optional().describe('Recipient email address(es), comma-separated'),
	subject: z.string().optional().describe('Email subject'),
	body: z.string().optional().describe('Email body (plain text)'),
	cc: z.string().optional().describe('CC email address(es), comma-separated'),
	bcc: z.string().optional().describe('BCC email address(es), comma-separated'),
	from: z.string().optional().describe('Sender email address (for send-as aliases)'),
	attachments: z.array(attachmentSchema).optional().describe('Optional file attachments (base64-encoded)'),
}, {});

const outputSchema = z.object({
	id: z.string(),
	message: z.object({
		id: z.string(),
		threadId: z.string(),
	}).optional(),
});

/**
 * The thread a draft currently belongs to, or undefined if it can't be read.
 * A failed lookup must not block the update — worst case we fall back to the
 * old behaviour of letting Gmail re-thread.
 */
async function getDraftThreadId(draftId: string, token: string): Promise<string | undefined> {
	try {
		const draft = await makeGmailApiCall('GET', `/users/me/drafts/${draftId}?format=minimal`, token) as {message?: {threadId?: string}};
		return draft.message?.threadId;
	} catch {
		return undefined;
	}
}

export function registerDraftUpdate(server: McpServer, config: Config): void {
	server.registerTool(
		'draft_update',
		{
			title: 'Update draft',
			description: 'Update an existing draft',
			inputSchema,
			outputSchema,
			annotations: {
				readOnlyHint: false,
				destructiveHint: true,
				idempotentHint: true,
			},
		},
		async ({draftId, threadId, to, subject, body, cc, bcc, from, attachments}) => {
			const lines = [
				...(from ? [`From: ${from}`] : []),
				...(to ? [`To: ${to}`] : []),
				...(subject ? [`Subject: ${encodeHeaderValue(subject)}`] : []),
				...(cc ? [`Cc: ${cc}`] : []),
				...(bcc ? [`Bcc: ${bcc}`] : []),
			];

			appendMimeBody(lines, body ?? '', attachments);

			const email = lines.join('\r\n');
			const encodedEmail = Buffer.from(email).toString('base64url');

			// drafts.update replaces the whole message, and Gmail re-threads from
			// scratch: without an explicit message.threadId the draft is moved into
			// a brand new thread of its own, silently detaching reply drafts from
			// their conversation. Carry the draft's current thread over by default.
			const resolvedThreadId = threadId ?? await getDraftThreadId(draftId, config.token);

			const message: {raw: string; threadId?: string} = {raw: encodedEmail};
			if (resolvedThreadId) {
				message.threadId = resolvedThreadId;
			}

			const result = await makeGmailApiCall('PUT', `/users/me/drafts/${draftId}`, config.token, {message});
			return jsonResult(outputSchema.parse(result));
		},
	);
}

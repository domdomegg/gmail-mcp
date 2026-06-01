import {z} from 'zod';
import type {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import type {Config} from './types.js';
import {makeGmailApiCall} from '../utils/gmail-api.js';
import {jsonResult} from '../utils/response.js';
import {strictSchemaWithAliases} from '../utils/schema.js';
import {appendMimeBody, attachmentSchema, encodeHeaderValue} from '../utils/mime.js';

const inputSchema = strictSchemaWithAliases({
	draftId: z.string().describe('The ID of the draft to update'),
	threadId: z.string().optional().describe('Thread ID to keep the draft attached to. Defaults to the draft\'s existing thread, so updates no longer detach reply drafts.'),
	to: z.string().optional().describe('Recipient email address(es), comma-separated'),
	subject: z.string().optional().describe('Email subject'),
	body: z.string().optional().describe('Email body (plain text). Used as the plain-text alternative when htmlBody is also provided.'),
	htmlBody: z.string().optional().describe('Optional HTML body. When set, the message is sent as multipart/alternative with both plain text (body) and HTML.'),
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

export function registerDraftUpdate(server: McpServer, config: Config): void {
	server.registerTool(
		'draft_update',
		{
			title: 'Update draft',
			description: 'Update an existing draft',
			inputSchema,
			outputSchema,
		},
		async ({draftId, threadId, to, subject, body, htmlBody, cc, bcc, from, attachments}) => {
			const lines = [
				...(from ? [`From: ${from}`] : []),
				...(to ? [`To: ${to}`] : []),
				...(subject ? [`Subject: ${encodeHeaderValue(subject)}`] : []),
				...(cc ? [`Cc: ${cc}`] : []),
				...(bcc ? [`Bcc: ${bcc}`] : []),
			];

			appendMimeBody(lines, body ?? '', attachments, htmlBody);

			const email = lines.join('\r\n');
			const encodedEmail = Buffer.from(email).toString('base64url');

			// Gmail's drafts.update replaces the whole message, dropping the thread
			// association unless message.threadId is supplied. Preserve the draft's
			// existing thread by default so reply drafts stay in their conversation.
			let resolvedThreadId = threadId;
			if (!resolvedThreadId) {
				const existing = await makeGmailApiCall('GET', `/users/me/drafts/${draftId}?fields=message/threadId`, config.token) as {message?: {threadId?: string}};
				resolvedThreadId = existing.message?.threadId;
			}

			const message: {raw: string; threadId?: string} = {raw: encodedEmail};
			if (resolvedThreadId) {
				message.threadId = resolvedThreadId;
			}

			const result = await makeGmailApiCall('PUT', `/users/me/drafts/${draftId}`, config.token, {message});
			return jsonResult(outputSchema.parse(result));
		},
	);
}

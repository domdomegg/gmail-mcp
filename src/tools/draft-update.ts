import {z} from 'zod';
import type {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import type {Config} from './types.js';
import {makeGmailApiCall} from '../utils/gmail-api.js';
import {jsonResult} from '../utils/response.js';
import {strictSchemaWithAliases} from '../utils/schema.js';
import {appendMimeBody, attachmentSchema} from '../utils/mime.js';

const inputSchema = strictSchemaWithAliases({
	draftId: z.string().describe('The ID of the draft to update'),
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

export function registerDraftUpdate(server: McpServer, config: Config): void {
	server.registerTool(
		'draft_update',
		{
			title: 'Update draft',
			description: 'Update an existing draft',
			inputSchema,
			outputSchema,
		},
		async ({draftId, to, subject, body, cc, bcc, from, attachments}) => {
			const lines: string[] = [];

			if (from) {
				lines.push(`From: ${from}`);
			}

			if (to) {
				lines.push(`To: ${to}`);
			}

			if (subject) {
				lines.push(`Subject: ${subject}`);
			}

			if (cc) {
				lines.push(`Cc: ${cc}`);
			}

			if (bcc) {
				lines.push(`Bcc: ${bcc}`);
			}

			appendMimeBody(lines, body ?? '', attachments);

			const email = lines.join('\r\n');
			const encodedEmail = Buffer.from(email).toString('base64url');

			const result = await makeGmailApiCall('PUT', `/users/me/drafts/${draftId}`, config.token, {
				message: {raw: encodedEmail},
			});
			return jsonResult(outputSchema.parse(result));
		},
	);
}

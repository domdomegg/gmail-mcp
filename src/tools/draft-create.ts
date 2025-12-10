import {z} from 'zod';
import type {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import type {Config} from './types.js';
import {makeGmailApiCall} from '../utils/gmail-api.js';
import {jsonResult} from '../utils/response.js';

const inputSchema = {
	to: z.string().describe('Recipient email address(es), comma-separated for multiple'),
	subject: z.string().describe('Email subject'),
	body: z.string().describe('Email body (plain text)'),
	cc: z.string().optional().describe('CC recipients, comma-separated'),
	bcc: z.string().optional().describe('BCC recipients, comma-separated'),
	threadId: z.string().optional().describe('Thread ID if this is a reply draft'),
	inReplyTo: z.string().optional().describe('Message-ID header of the message being replied to'),
};

const outputSchema = z.object({
	id: z.string(),
	message: z.object({
		id: z.string(),
		threadId: z.string(),
		labelIds: z.array(z.string()).optional(),
	}),
});

/**
 * Create an RFC 2822 formatted email message and base64url encode it.
 */
function createRawMessage(options: {
	to: string;
	subject: string;
	body: string;
	cc?: string;
	bcc?: string;
	inReplyTo?: string;
}): string {
	const lines: string[] = [];

	lines.push(`To: ${options.to}`);
	if (options.cc) {
		lines.push(`Cc: ${options.cc}`);
	}

	if (options.bcc) {
		lines.push(`Bcc: ${options.bcc}`);
	}

	lines.push(`Subject: ${options.subject}`);
	if (options.inReplyTo) {
		lines.push(`In-Reply-To: ${options.inReplyTo}`);
		lines.push(`References: ${options.inReplyTo}`);
	}

	lines.push('Content-Type: text/plain; charset=utf-8');
	lines.push('');
	lines.push(options.body);

	const message = lines.join('\r\n');

	return Buffer.from(message)
		.toString('base64')
		.replace(/\+/g, '-')
		.replace(/\//g, '_')
		.replace(/=+$/, '');
}

export function registerDraftCreate(server: McpServer, config: Config): void {
	server.registerTool(
		'draft_create',
		{
			title: 'Create draft',
			description: 'Create a new draft email. The draft can be edited and sent later from Gmail.',
			inputSchema,
			outputSchema,
		},
		async ({to, subject, body, cc, bcc, threadId, inReplyTo}) => {
			const raw = createRawMessage({
				to,
				subject,
				body,
				...(cc && {cc}),
				...(bcc && {bcc}),
				...(inReplyTo && {inReplyTo}),
			});

			const requestBody: {message: {raw: string; threadId?: string}} = {
				message: {raw},
			};
			if (threadId) {
				requestBody.message.threadId = threadId;
			}

			const result = await makeGmailApiCall('POST', '/users/me/drafts', config.token, requestBody);
			return jsonResult(outputSchema.parse(result));
		},
	);
}

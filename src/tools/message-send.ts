import {z} from 'zod';
import type {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import type {Config} from './types.js';
import {makeGmailApiCall} from '../utils/gmail-api.js';
import {jsonResult} from '../utils/response.js';
import {strictSchemaWithAliases} from '../utils/schema.js';
import {appendMimeBody, encodeHeaderValue} from '../utils/mime.js';

const inputSchema = strictSchemaWithAliases({
	to: z.string().describe('Recipient email address(es), comma-separated for multiple'),
	subject: z.string().describe('Email subject'),
	body: z.string().describe('Email body (plain text). Used as the plain-text alternative when htmlBody is also provided.'),
	htmlBody: z.string().optional().describe('Optional HTML body. When set, the message is sent as multipart/alternative with both plain text (body) and HTML.'),
	cc: z.string().optional().describe('CC recipients, comma-separated'),
	bcc: z.string().optional().describe('BCC recipients, comma-separated'),
	from: z.string().optional().describe('Sender email address (for send-as aliases)'),
	threadId: z.string().optional().describe('Thread ID to reply to'),
	inReplyTo: z.string().optional().describe('Message-ID header of the message being replied to'),
}, {});

const outputSchema = z.object({
	id: z.string(),
	threadId: z.string(),
	labelIds: z.array(z.string()).optional(),
});

/**
 * Create an RFC 2822 formatted email message and base64url encode it.
 */
function createRawMessage(options: {
	to: string;
	subject: string;
	body: string;
	htmlBody?: string;
	cc?: string;
	bcc?: string;
	from?: string;
	inReplyTo?: string;
}): string {
	const lines: string[] = [];

	if (options.from) {
		lines.push(`From: ${options.from}`);
	}

	lines.push(`To: ${options.to}`);
	if (options.cc) {
		lines.push(`Cc: ${options.cc}`);
	}

	if (options.bcc) {
		lines.push(`Bcc: ${options.bcc}`);
	}

	lines.push(`Subject: ${encodeHeaderValue(options.subject)}`);
	if (options.inReplyTo) {
		lines.push(`In-Reply-To: ${options.inReplyTo}`);
		lines.push(`References: ${options.inReplyTo}`);
	}

	appendMimeBody(lines, options.body, undefined, options.htmlBody);

	const message = lines.join('\r\n');

	// Base64url encode (replace + with -, / with _, remove =)
	return Buffer.from(message)
		.toString('base64')
		.replace(/\+/g, '-')
		.replace(/\//g, '_')
		.replace(/=+$/, '');
}

export function registerMessageSend(server: McpServer, config: Config): void {
	server.registerTool(
		'message_send',
		{
			title: 'Send message',
			description: 'Send an email message. Can also be used to reply to existing threads.',
			inputSchema,
			outputSchema,
		},
		async ({to, subject, body, htmlBody, cc, bcc, from, threadId, inReplyTo}) => {
			const raw = createRawMessage({
				to,
				subject,
				body,
				...(htmlBody && {htmlBody}),
				...(cc && {cc}),
				...(bcc && {bcc}),
				...(from && {from}),
				...(inReplyTo && {inReplyTo}),
			});

			const requestBody: {raw: string; threadId?: string} = {raw};
			if (threadId) {
				requestBody.threadId = threadId;
			}

			const result = await makeGmailApiCall('POST', '/users/me/messages/send', config.token, requestBody);
			return jsonResult(outputSchema.parse(result));
		},
	);
}

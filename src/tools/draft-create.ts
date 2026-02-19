import {z} from 'zod';
import {readFileSync} from 'fs';
import {extname} from 'path';
import type {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import type {Config} from './types.js';
import {makeGmailApiCall} from '../utils/gmail-api.js';
import {jsonResult} from '../utils/response.js';
import {strictSchemaWithAliases} from '../utils/schema.js';

const attachmentSchema = z.object({
	filename: z.string().describe('Attachment filename'),
	mimeType: z.string().optional().describe('MIME type (e.g., application/pdf). Optional if filePath is provided and type can be inferred'),
	content: z.string().optional().describe('Base64-encoded file data. Either content or filePath must be provided'),
	filePath: z.string().optional().describe('Absolute path to file on disk. Either content or filePath must be provided'),
}).refine(
	(data) => data.content !== undefined || data.filePath !== undefined,
	{message: 'Either content or filePath must be provided'},
);

const inputSchema = strictSchemaWithAliases({
	to: z.string().describe('Recipient email address(es), comma-separated for multiple'),
	subject: z.string().describe('Email subject'),
	body: z.string().describe('Email body (plain text)'),
	cc: z.string().optional().describe('CC recipients, comma-separated'),
	bcc: z.string().optional().describe('BCC recipients, comma-separated'),
	from: z.string().optional().describe('Sender email address (for send-as aliases)'),
	threadId: z.string().optional().describe('Thread ID if this is a reply draft'),
	inReplyTo: z.string().optional().describe('Message-ID header of the message being replied to'),
	attachments: z.array(attachmentSchema).optional().describe('Optional attachments'),
}, {});

const outputSchema = z.object({
	id: z.string(),
	message: z.object({
		id: z.string(),
		threadId: z.string(),
		labelIds: z.array(z.string()).optional(),
	}),
});

/**
 * Infer MIME type from file extension.
 */
function inferMimeType(filePath: string): string {
	const ext = extname(filePath).toLowerCase();
	const mimeMap: Record<string, string> = {
		// Images
		'.jpg': 'image/jpeg',
		'.jpeg': 'image/jpeg',
		'.png': 'image/png',
		'.gif': 'image/gif',
		'.webp': 'image/webp',
		'.svg': 'image/svg+xml',
		'.bmp': 'image/bmp',
		'.ico': 'image/x-icon',
		'.tiff': 'image/tiff',
		// Documents
		'.pdf': 'application/pdf',
		'.doc': 'application/msword',
		'.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
		'.xls': 'application/vnd.ms-excel',
		'.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
		'.ppt': 'application/vnd.ms-powerpoint',
		'.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
		'.odt': 'application/vnd.oasis.opendocument.text',
		'.ods': 'application/vnd.oasis.opendocument.spreadsheet',
		'.odp': 'application/vnd.oasis.opendocument.presentation',
		// Text
		'.txt': 'text/plain',
		'.csv': 'text/csv',
		'.html': 'text/html',
		'.htm': 'text/html',
		'.xml': 'application/xml',
		'.json': 'application/json',
		'.md': 'text/markdown',
		// Video
		'.mp4': 'video/mp4',
		'.mov': 'video/quicktime',
		'.avi': 'video/x-msvideo',
		'.webm': 'video/webm',
		'.mkv': 'video/x-matroska',
		// Audio
		'.mp3': 'audio/mpeg',
		'.wav': 'audio/wav',
		'.ogg': 'audio/ogg',
		'.m4a': 'audio/mp4',
		// Archives
		'.zip': 'application/zip',
		'.gz': 'application/gzip',
		'.tar': 'application/x-tar',
		'.rar': 'application/vnd.rar',
		'.7z': 'application/x-7z-compressed',
	};
	return mimeMap[ext] || 'application/octet-stream';
}

/**
 * Process attachment: read from disk if filePath is provided, otherwise use content.
 */
function processAttachment(attachment: z.infer<typeof attachmentSchema>): {filename: string; mimeType: string; content: string} {
	let content: string;
	let mimeType: string;

	// filePath takes precedence
	if (attachment.filePath) {
		const fileBuffer = readFileSync(attachment.filePath);
		content = fileBuffer.toString('base64');
		mimeType = attachment.mimeType || inferMimeType(attachment.filePath);
	} else if (attachment.content) {
		content = attachment.content;
		mimeType = attachment.mimeType || 'application/octet-stream';
	} else {
		throw new Error('Either content or filePath must be provided');
	}

	return {
		filename: attachment.filename,
		mimeType,
		content,
	};
}

/**
 * Create an RFC 2822 formatted email message and base64url encode it.
 */
function createRawMessage(options: {
	to: string;
	subject: string;
	body: string;
	cc?: string;
	bcc?: string;
	from?: string;
	inReplyTo?: string;
	attachments?: {filename: string; mimeType: string; content: string}[];
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

	lines.push(`Subject: ${options.subject}`);
	if (options.inReplyTo) {
		lines.push(`In-Reply-To: ${options.inReplyTo}`);
		lines.push(`References: ${options.inReplyTo}`);
	}

	// Build multipart message if attachments are present
	if (options.attachments && options.attachments.length > 0) {
		const boundary = `boundary_${Date.now()}_${Math.random().toString(36).substring(2)}`;
		lines.push(`Content-Type: multipart/mixed; boundary="${boundary}"`);
		lines.push('');

		// Text body part
		lines.push(`--${boundary}`);
		lines.push('Content-Type: text/plain; charset=utf-8');
		lines.push('');
		lines.push(options.body);
		lines.push('');

		// Attachment parts
		for (const attachment of options.attachments) {
			lines.push(`--${boundary}`);
			lines.push(`Content-Type: ${attachment.mimeType}`);
			lines.push('Content-Transfer-Encoding: base64');
			lines.push(`Content-Disposition: attachment; filename="${attachment.filename}"`);
			lines.push('');
			lines.push(attachment.content);
			lines.push('');
		}

		lines.push(`--${boundary}--`);
	} else {
		// Plain text message (existing behavior)
		lines.push('Content-Type: text/plain; charset=utf-8');
		lines.push('');
		lines.push(options.body);
	}

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
		async ({to, subject, body, cc, bcc, from, threadId, inReplyTo, attachments}) => {
			// Process attachments if provided
			const processedAttachments = attachments?.map(processAttachment);

			const raw = createRawMessage({
				to,
				subject,
				body,
				...(cc && {cc}),
				...(bcc && {bcc}),
				...(from && {from}),
				...(inReplyTo && {inReplyTo}),
				...(processedAttachments && {attachments: processedAttachments}),
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

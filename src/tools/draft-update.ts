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
	draftId: z.string().describe('The ID of the draft to update'),
	to: z.string().optional().describe('Recipient email address(es), comma-separated'),
	subject: z.string().optional().describe('Email subject'),
	body: z.string().optional().describe('Email body (plain text)'),
	cc: z.string().optional().describe('CC email address(es), comma-separated'),
	bcc: z.string().optional().describe('BCC email address(es), comma-separated'),
	from: z.string().optional().describe('Sender email address (for send-as aliases)'),
	attachments: z.array(attachmentSchema).optional().describe('Optional attachments'),
}, {});

const outputSchema = z.object({
	id: z.string(),
	message: z.object({
		id: z.string(),
		threadId: z.string(),
	}).optional(),
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
			// Process attachments if provided
			const processedAttachments = attachments?.map(processAttachment);

			const lines: string[] = [];

			// Add headers
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

			// Build multipart message if attachments are present
			if (processedAttachments && processedAttachments.length > 0) {
				const boundary = `boundary_${Date.now()}_${Math.random().toString(36).substring(2)}`;
				lines.push(`Content-Type: multipart/mixed; boundary="${boundary}"`);
				lines.push('');

				// Text body part
				lines.push(`--${boundary}`);
				lines.push('Content-Type: text/plain; charset=utf-8');
				lines.push('');
				lines.push(body ?? '');
				lines.push('');

				// Attachment parts
				for (const attachment of processedAttachments) {
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
				lines.push(body ?? '');
			}

			const email = lines.join('\r\n');
			const encodedEmail = Buffer.from(email).toString('base64url');

			const result = await makeGmailApiCall('PUT', `/users/me/drafts/${draftId}`, config.token, {
				message: {raw: encodedEmail},
			});
			return jsonResult(outputSchema.parse(result));
		},
	);
}

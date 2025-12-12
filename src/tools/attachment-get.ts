import {z} from 'zod';
import type {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import type {Config} from './types.js';
import {makeGmailApiCall} from '../utils/gmail-api.js';
import {jsonResult} from '../utils/response.js';

const inputSchema = {
	messageId: z.string().describe('The ID of the message containing the attachment'),
	attachmentId: z.string().describe('The ID of the attachment'),
};

const outputSchema = z.object({
	size: z.number(),
	data: z.string().describe('Base64url-encoded attachment data'),
});

export function registerAttachmentGet(server: McpServer, config: Config): void {
	server.registerTool(
		'attachment_get',
		{
			title: 'Get attachment',
			description: 'Get a message attachment. Returns base64url-encoded data.',
			inputSchema,
			outputSchema,
			annotations: {
				readOnlyHint: true,
			},
		},
		async ({messageId, attachmentId}) => {
			const result = await makeGmailApiCall('GET', `/users/me/messages/${messageId}/attachments/${attachmentId}`, config.token);
			return jsonResult(outputSchema.parse(result));
		},
	);
}

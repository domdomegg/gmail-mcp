import {z} from 'zod';
import type {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import type {Config} from './types.js';
import {makeGmailApiCall} from '../utils/gmail-api.js';
import {jsonResult} from '../utils/response.js';

const inputSchema = {
	messageId: z.string().describe('The ID of the message to permanently delete'),
};

const outputSchema = z.object({
	success: z.literal(true),
	messageId: z.string(),
});

export function registerMessageDelete(server: McpServer, config: Config): void {
	server.registerTool(
		'message_delete',
		{
			title: 'Delete message',
			description: 'Permanently delete a message. This cannot be undone. Prefer gmail_message_trash for most cases.',
			inputSchema,
			outputSchema,
		},
		async ({messageId}) => {
			await makeGmailApiCall('DELETE', `/users/me/messages/${messageId}`, config.token);
			return jsonResult({success: true as const, messageId});
		},
	);
}

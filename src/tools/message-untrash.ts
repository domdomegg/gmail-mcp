import {z} from 'zod';
import type {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import type {Config} from './types.js';
import {makeGmailApiCall} from '../utils/gmail-api.js';
import {jsonResult} from '../utils/response.js';

const inputSchema = {
	messageId: z.string().describe('The ID of the message to restore from trash'),
};

const outputSchema = z.object({
	id: z.string(),
	threadId: z.string(),
	labelIds: z.array(z.string()).optional(),
});

export function registerMessageUntrash(server: McpServer, config: Config): void {
	server.registerTool(
		'gmail_message_untrash',
		{
			title: 'Untrash message',
			description: 'Remove a message from trash',
			inputSchema,
			outputSchema,
		},
		async ({messageId}) => {
			const result = await makeGmailApiCall('POST', `/users/me/messages/${messageId}/untrash`, config.token);
			return jsonResult(outputSchema.parse(result));
		},
	);
}

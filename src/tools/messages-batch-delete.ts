import {z} from 'zod';
import type {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import type {Config} from './types.js';
import {makeGmailApiCall} from '../utils/gmail-api.js';
import {jsonResult} from '../utils/response.js';

const inputSchema = {
	messageIds: z.array(z.string()).describe('The IDs of messages to permanently delete'),
};

const outputSchema = z.object({
	success: z.literal(true),
	deletedCount: z.number(),
});

export function registerMessagesBatchDelete(server: McpServer, config: Config): void {
	server.registerTool(
		'messages_batch_delete',
		{
			title: 'Batch delete messages',
			description: 'Permanently delete multiple messages. This cannot be undone.',
			inputSchema,
			outputSchema,
		},
		async ({messageIds}) => {
			await makeGmailApiCall('POST', '/users/me/messages/batchDelete', config.token, {
				ids: messageIds,
			});
			return jsonResult({success: true as const, deletedCount: messageIds.length});
		},
	);
}

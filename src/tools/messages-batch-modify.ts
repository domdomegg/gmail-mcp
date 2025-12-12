import {z} from 'zod';
import type {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import type {Config} from './types.js';
import {makeGmailApiCall} from '../utils/gmail-api.js';
import {jsonResult} from '../utils/response.js';

const inputSchema = {
	messageIds: z.array(z.string()).describe('The IDs of messages to modify'),
	addLabelIds: z.array(z.string()).optional().describe('Label IDs to add'),
	removeLabelIds: z.array(z.string()).optional().describe('Label IDs to remove'),
};

const outputSchema = z.object({
	success: z.literal(true),
	modifiedCount: z.number(),
});

export function registerMessagesBatchModify(server: McpServer, config: Config): void {
	server.registerTool(
		'messages_batch_modify',
		{
			title: 'Batch modify messages',
			description: 'Modify labels on multiple messages at once',
			inputSchema,
			outputSchema,
		},
		async ({messageIds, addLabelIds, removeLabelIds}) => {
			await makeGmailApiCall('POST', '/users/me/messages/batchModify', config.token, {
				ids: messageIds,
				addLabelIds,
				removeLabelIds,
			});
			return jsonResult({success: true as const, modifiedCount: messageIds.length});
		},
	);
}

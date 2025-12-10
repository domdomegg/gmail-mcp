import {z} from 'zod';
import type {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import type {Config} from './types.js';
import {makeGmailApiCall} from '../utils/gmail-api.js';
import {jsonResult} from '../utils/response.js';

const inputSchema = {
	threadId: z.string().describe('The ID of the thread to modify'),
	addLabelIds: z.array(z.string()).optional().describe('Label IDs to add'),
	removeLabelIds: z.array(z.string()).optional().describe('Label IDs to remove'),
};

const outputSchema = z.object({
	id: z.string(),
	historyId: z.string().optional(),
});

export function registerThreadModify(server: McpServer, config: Config): void {
	server.registerTool(
		'gmail_thread_modify',
		{
			title: 'Modify thread',
			description: 'Modify labels on a thread',
			inputSchema,
			outputSchema,
		},
		async ({threadId, addLabelIds, removeLabelIds}) => {
			const result = await makeGmailApiCall('POST', `/users/me/threads/${threadId}/modify`, config.token, {
				addLabelIds,
				removeLabelIds,
			});
			return jsonResult(outputSchema.parse(result));
		},
	);
}

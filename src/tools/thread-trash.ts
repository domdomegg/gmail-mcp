import {z} from 'zod';
import type {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import type {Config} from './types.js';
import {makeGmailApiCall} from '../utils/gmail-api.js';
import {jsonResult} from '../utils/response.js';

const inputSchema = {
	threadId: z.string().describe('The ID of the thread to trash'),
};

const outputSchema = z.object({
	id: z.string(),
	historyId: z.string().optional(),
});

export function registerThreadTrash(server: McpServer, config: Config): void {
	server.registerTool(
		'gmail_thread_trash',
		{
			title: 'Trash thread',
			description: 'Move a thread to trash',
			inputSchema,
			outputSchema,
		},
		async ({threadId}) => {
			const result = await makeGmailApiCall('POST', `/users/me/threads/${threadId}/trash`, config.token);
			return jsonResult(outputSchema.parse(result));
		},
	);
}

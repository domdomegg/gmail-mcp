import {z} from 'zod';
import type {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import type {Config} from './types.js';
import {makeGmailApiCall} from '../utils/gmail-api.js';
import {jsonResult} from '../utils/response.js';

const inputSchema = {
	threadId: z.string().describe('The ID of the thread to permanently delete'),
};

const outputSchema = z.object({
	success: z.literal(true),
	threadId: z.string(),
});

export function registerThreadDelete(server: McpServer, config: Config): void {
	server.registerTool(
		'thread_delete',
		{
			title: 'Delete thread',
			description: 'Permanently delete a thread. This cannot be undone. Prefer gmail_thread_trash for most cases.',
			inputSchema,
			outputSchema,
		},
		async ({threadId}) => {
			await makeGmailApiCall('DELETE', `/users/me/threads/${threadId}`, config.token);
			return jsonResult({success: true as const, threadId});
		},
	);
}

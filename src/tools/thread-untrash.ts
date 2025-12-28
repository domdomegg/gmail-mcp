import {z} from 'zod';
import type {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import type {Config} from './types.js';
import {makeGmailApiCall} from '../utils/gmail-api.js';
import {jsonResult} from '../utils/response.js';
import {strictSchemaWithAliases} from '../utils/schema.js';

const inputSchema = strictSchemaWithAliases({
	threadId: z.string().describe('The ID of the thread to restore from trash'),
}, {});

const outputSchema = z.object({
	id: z.string(),
	historyId: z.string().optional(),
});

export function registerThreadUntrash(server: McpServer, config: Config): void {
	server.registerTool(
		'thread_untrash',
		{
			title: 'Untrash thread',
			description: 'Remove a thread from trash',
			inputSchema,
			outputSchema,
		},
		async ({threadId}) => {
			const result = await makeGmailApiCall('POST', `/users/me/threads/${threadId}/untrash`, config.token);
			return jsonResult(outputSchema.parse(result));
		},
	);
}

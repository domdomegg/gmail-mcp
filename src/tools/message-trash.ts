import {z} from 'zod';
import type {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import type {Config} from './types.js';
import {makeGmailApiCall} from '../utils/gmail-api.js';
import {jsonResult} from '../utils/response.js';
import {strictSchemaWithAliases} from '../utils/schema.js';

const inputSchema = strictSchemaWithAliases({
	id: z.string().describe('The ID of the message to trash'),
}, {});

const outputSchema = z.object({
	id: z.string(),
	threadId: z.string(),
	labelIds: z.array(z.string()).optional(),
});

export function registerMessageTrash(server: McpServer, config: Config): void {
	server.registerTool(
		'message_trash',
		{
			title: 'Trash message',
			description: 'Move a message to the trash. Messages in trash are deleted after 30 days.',
			inputSchema,
			outputSchema,
		},
		async ({id}) => {
			const result = await makeGmailApiCall('POST', `/users/me/messages/${id}/trash`, config.token);
			return jsonResult(outputSchema.parse(result));
		},
	);
}

import {z} from 'zod';
import type {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import type {Config} from './types.js';
import {makeGmailApiCall} from '../utils/gmail-api.js';
import {jsonResult} from '../utils/response.js';

const inputSchema = {
	id: z.string().describe('The ID of the message to archive'),
};

const outputSchema = z.object({
	id: z.string(),
	threadId: z.string(),
	labelIds: z.array(z.string()).optional(),
});

export function registerMessageArchive(server: McpServer, config: Config): void {
	server.registerTool(
		'message_archive',
		{
			title: 'Archive message',
			description: 'Archive a message by removing the INBOX label. The message remains accessible via search or All Mail.',
			inputSchema,
			outputSchema,
		},
		async ({id}) => {
			const result = await makeGmailApiCall('POST', `/users/me/messages/${id}/modify`, config.token, {
				removeLabelIds: ['INBOX'],
			});
			return jsonResult(outputSchema.parse(result));
		},
	);
}

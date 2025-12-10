import {z} from 'zod';
import type {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import type {Config} from './types.js';
import {makeGmailApiCall} from '../utils/gmail-api.js';
import {jsonResult} from '../utils/response.js';

const inputSchema = {
	draftId: z.string().describe('The ID of the draft to send'),
};

const outputSchema = z.object({
	id: z.string(),
	threadId: z.string(),
	labelIds: z.array(z.string()).optional(),
});

export function registerDraftSend(server: McpServer, config: Config): void {
	server.registerTool(
		'gmail_draft_send',
		{
			title: 'Send draft',
			description: 'Send an existing draft',
			inputSchema,
			outputSchema,
		},
		async ({draftId}) => {
			const result = await makeGmailApiCall('POST', '/users/me/drafts/send', config.token, {
				id: draftId,
			});
			return jsonResult(outputSchema.parse(result));
		},
	);
}

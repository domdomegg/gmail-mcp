import {z} from 'zod';
import type {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import type {Config} from './types.js';
import {makeGmailApiCall} from '../utils/gmail-api.js';
import {jsonResult} from '../utils/response.js';

const inputSchema = {
	draftId: z.string().describe('The ID of the draft to retrieve'),
	format: z.enum(['minimal', 'full', 'raw', 'metadata']).default('full').describe('Format of the message'),
};

const outputSchema = z.object({
	id: z.string(),
	message: z.object({
		id: z.string(),
		threadId: z.string(),
		labelIds: z.array(z.string()).optional(),
		snippet: z.string().optional(),
		payload: z.any().optional(),
		raw: z.string().optional(),
	}).optional(),
});

export function registerDraftGet(server: McpServer, config: Config): void {
	server.registerTool(
		'draft_get',
		{
			title: 'Get draft',
			description: 'Get a specific draft by ID',
			inputSchema,
			outputSchema,
			annotations: {
				readOnlyHint: true,
			},
		},
		async ({draftId, format}) => {
			const params = new URLSearchParams({format});
			const result = await makeGmailApiCall('GET', `/users/me/drafts/${draftId}?${params.toString()}`, config.token);
			return jsonResult(outputSchema.parse(result));
		},
	);
}

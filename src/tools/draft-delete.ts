import {z} from 'zod';
import type {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import type {Config} from './types.js';
import {makeGmailApiCall} from '../utils/gmail-api.js';
import {jsonResult} from '../utils/response.js';
import {strictSchemaWithAliases} from '../utils/schema.js';

const inputSchema = strictSchemaWithAliases({
	draftId: z.string().describe('The ID of the draft to delete'),
}, {});

const outputSchema = z.object({
	success: z.literal(true),
	draftId: z.string(),
});

export function registerDraftDelete(server: McpServer, config: Config): void {
	server.registerTool(
		'draft_delete',
		{
			title: 'Delete draft',
			description: 'Permanently delete a draft',
			inputSchema,
			outputSchema,
		},
		async ({draftId}) => {
			await makeGmailApiCall('DELETE', `/users/me/drafts/${draftId}`, config.token);
			return jsonResult({success: true as const, draftId});
		},
	);
}

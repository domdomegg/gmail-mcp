import {z} from 'zod';
import type {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import type {Config} from './types.js';
import {makeGmailApiCall} from '../utils/gmail-api.js';
import {jsonResult} from '../utils/response.js';

const inputSchema = {
	maxResults: z.number().min(1).max(500).default(10).describe('Maximum number of drafts to return'),
	pageToken: z.string().optional().describe('Page token for pagination'),
	q: z.string().optional().describe('Search query to filter drafts'),
	includeSpamTrash: z.boolean().default(false).describe('Include spam and trash in results'),
};

const outputSchema = z.object({
	drafts: z.array(z.object({
		id: z.string(),
		message: z.object({
			id: z.string(),
			threadId: z.string(),
		}).optional(),
	})).optional(),
	nextPageToken: z.string().optional(),
	resultSizeEstimate: z.number().optional(),
});

export function registerDraftsList(server: McpServer, config: Config): void {
	server.registerTool(
		'gmail_drafts_list',
		{
			title: 'List drafts',
			description: 'List all drafts',
			inputSchema,
			outputSchema,
			annotations: {
				readOnlyHint: true,
			},
		},
		async ({maxResults, pageToken, q, includeSpamTrash}) => {
			const params = new URLSearchParams();
			if (maxResults) {
				params.set('maxResults', String(maxResults));
			}

			if (pageToken) {
				params.set('pageToken', pageToken);
			}

			if (q) {
				params.set('q', q);
			}

			if (includeSpamTrash) {
				params.set('includeSpamTrash', 'true');
			}

			const result = await makeGmailApiCall('GET', `/users/me/drafts?${params.toString()}`, config.token);
			return jsonResult(outputSchema.parse(result));
		},
	);
}

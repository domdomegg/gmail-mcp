import {z} from 'zod';
import type {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import type {Config} from './types.js';
import {makeGmailApiCall} from '../utils/gmail-api.js';
import {jsonResult} from '../utils/response.js';

const inputSchema = {
	q: z.string().optional().describe('Search query (same syntax as Gmail search box)'),
	maxResults: z.number().min(1).max(500).default(10).describe('Maximum number of threads to return'),
	pageToken: z.string().optional().describe('Page token for pagination'),
	labelIds: z.array(z.string()).optional().describe('Only return threads with these label IDs'),
	includeSpamTrash: z.boolean().default(false).describe('Include spam and trash in results'),
};

const outputSchema = z.object({
	threads: z.array(z.object({
		id: z.string(),
		snippet: z.string().optional(),
		historyId: z.string().optional(),
	})).optional(),
	nextPageToken: z.string().optional(),
	resultSizeEstimate: z.number().optional(),
});

export function registerThreadsList(server: McpServer, config: Config): void {
	server.registerTool(
		'gmail_threads_list',
		{
			title: 'List threads',
			description: 'List or search email threads (conversations). Recommended over messages_list for most use cases.',
			inputSchema,
			outputSchema,
			annotations: {
				readOnlyHint: true,
			},
		},
		async ({q, maxResults, pageToken, labelIds, includeSpamTrash}) => {
			const params = new URLSearchParams();
			if (q) {
				params.set('q', q);
			}

			if (maxResults) {
				params.set('maxResults', String(maxResults));
			}

			if (pageToken) {
				params.set('pageToken', pageToken);
			}

			if (labelIds?.length) {
				for (const labelId of labelIds) {
					params.append('labelIds', labelId);
				}
			}

			if (includeSpamTrash) {
				params.set('includeSpamTrash', 'true');
			}

			const result = await makeGmailApiCall('GET', `/users/me/threads?${params.toString()}`, config.token);
			return jsonResult(outputSchema.parse(result));
		},
	);
}

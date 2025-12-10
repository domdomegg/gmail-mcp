import {z} from 'zod';
import type {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import type {Config} from './types.js';
import {makeGmailApiCall} from '../utils/gmail-api.js';
import {jsonResult} from '../utils/response.js';

const inputSchema = {
	q: z.string().optional().describe('Gmail search query (e.g., "from:someone@example.com", "is:unread", "subject:hello")'),
	maxResults: z.number().min(1).max(500).default(10).describe('Maximum number of messages to return'),
	pageToken: z.string().optional().describe('Page token for pagination'),
	labelIds: z.array(z.string()).optional().describe('Only return messages with these label IDs'),
	includeSpamTrash: z.boolean().default(false).describe('Include messages from SPAM and TRASH'),
};

const outputSchema = z.object({
	messages: z.array(z.object({
		id: z.string(),
		threadId: z.string(),
	})).optional(),
	nextPageToken: z.string().optional(),
	resultSizeEstimate: z.number().optional(),
});

export function registerMessagesList(server: McpServer, config: Config): void {
	server.registerTool(
		'messages_list',
		{
			title: 'List messages',
			description: 'List messages in the user\'s mailbox. Returns message IDs and thread IDs. Use message_get to fetch full message content.',
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

			const result = await makeGmailApiCall('GET', `/users/me/messages?${params.toString()}`, config.token);
			return jsonResult(outputSchema.parse(result));
		},
	);
}

import {z} from 'zod';
import type {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import type {Config} from './types.js';
import {makeGmailApiCall} from '../utils/gmail-api.js';
import {jsonResult} from '../utils/response.js';

const inputSchema = {
	id: z.string().describe('The ID of the thread to retrieve'),
	format: z.enum(['minimal', 'full', 'metadata']).default('full').describe('The format to return messages in'),
	metadataHeaders: z.array(z.string()).optional().describe('When format is metadata, only include these headers'),
};

const outputSchema = z.object({
	id: z.string(),
	historyId: z.string().optional(),
	messages: z.array(z.object({
		id: z.string(),
		threadId: z.string(),
		labelIds: z.array(z.string()).optional(),
		snippet: z.string().optional(),
		historyId: z.string().optional(),
		internalDate: z.string().optional(),
		payload: z.unknown().optional(),
		sizeEstimate: z.number().optional(),
	})).optional(),
});

export function registerThreadGet(server: McpServer, config: Config): void {
	server.registerTool(
		'thread_get',
		{
			title: 'Get thread',
			description: 'Get all messages in a thread (conversation). Recommended over gmail_message_get for reading emails.',
			inputSchema,
			outputSchema,
			annotations: {
				readOnlyHint: true,
			},
		},
		async ({id, format, metadataHeaders}) => {
			const params = new URLSearchParams();
			params.set('format', format);
			if (metadataHeaders?.length) {
				for (const header of metadataHeaders) {
					params.append('metadataHeaders', header);
				}
			}

			const result = await makeGmailApiCall('GET', `/users/me/threads/${id}?${params.toString()}`, config.token);
			return jsonResult(outputSchema.parse(result));
		},
	);
}

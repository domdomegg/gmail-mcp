import {z} from 'zod';
import type {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import type {Config} from './types.js';
import {makeGmailApiCall} from '../utils/gmail-api.js';
import {jsonResult} from '../utils/response.js';

const inputSchema = {
	id: z.string().describe('The ID of the message to retrieve'),
	format: z.enum(['minimal', 'full', 'raw', 'metadata']).default('full').describe('The format to return the message in'),
	metadataHeaders: z.array(z.string()).optional().describe('When format is metadata, only include these headers'),
};

// Gmail message structure (simplified)
const messagePartSchema: z.ZodType<unknown> = z.lazy(() => z.object({
	partId: z.string().optional(),
	mimeType: z.string().optional(),
	filename: z.string().optional(),
	headers: z.array(z.object({
		name: z.string(),
		value: z.string(),
	})).optional(),
	body: z.object({
		attachmentId: z.string().optional(),
		size: z.number().optional(),
		data: z.string().optional(),
	}).optional(),
	parts: z.array(messagePartSchema).optional(),
}));

const outputSchema = z.object({
	id: z.string(),
	threadId: z.string(),
	labelIds: z.array(z.string()).optional(),
	snippet: z.string().optional(),
	historyId: z.string().optional(),
	internalDate: z.string().optional(),
	payload: messagePartSchema.optional(),
	sizeEstimate: z.number().optional(),
	raw: z.string().optional(),
});

export function registerMessageGet(server: McpServer, config: Config): void {
	server.registerTool(
		'message_get',
		{
			title: 'Get message',
			description: 'Get a single message by ID. Consider using gmail_thread_get to get all messages in a conversation.',
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

			const result = await makeGmailApiCall('GET', `/users/me/messages/${id}?${params.toString()}`, config.token);
			return jsonResult(outputSchema.parse(result));
		},
	);
}

import {z} from 'zod';
import type {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import type {Config} from './types.js';
import {makeGmailApiCall} from '../utils/gmail-api.js';
import {jsonResult} from '../utils/response.js';

const inputSchema = {
	filterId: z.string().describe('The ID of the filter to retrieve'),
};

const outputSchema = z.object({
	id: z.string(),
	criteria: z.object({
		from: z.string().optional(),
		to: z.string().optional(),
		subject: z.string().optional(),
		query: z.string().optional(),
		negatedQuery: z.string().optional(),
		hasAttachment: z.boolean().optional(),
		excludeChats: z.boolean().optional(),
		size: z.number().optional(),
		sizeComparison: z.string().optional(),
	}).optional(),
	action: z.object({
		addLabelIds: z.array(z.string()).optional(),
		removeLabelIds: z.array(z.string()).optional(),
		forward: z.string().optional(),
	}).optional(),
});

export function registerFilterGet(server: McpServer, config: Config): void {
	server.registerTool(
		'gmail_filter_get',
		{
			title: 'Get filter',
			description: 'Get a specific filter by ID',
			inputSchema,
			outputSchema,
			annotations: {
				readOnlyHint: true,
			},
		},
		async ({filterId}) => {
			const result = await makeGmailApiCall('GET', `/users/me/settings/filters/${filterId}`, config.token);
			return jsonResult(outputSchema.parse(result));
		},
	);
}

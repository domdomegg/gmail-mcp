import {z} from 'zod';
import type {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import type {Config} from './types.js';
import {makeGmailApiCall} from '../utils/gmail-api.js';
import {jsonResult} from '../utils/response.js';
import {strictSchemaWithAliases} from '../utils/schema.js';

const inputSchema = strictSchemaWithAliases({
	labelId: z.string().describe('The ID of the label to retrieve'),
}, {});

const outputSchema = z.object({
	id: z.string(),
	name: z.string(),
	type: z.string().optional(),
	labelListVisibility: z.string().optional(),
	messageListVisibility: z.string().optional(),
	messagesTotal: z.number().optional(),
	messagesUnread: z.number().optional(),
	threadsTotal: z.number().optional(),
	threadsUnread: z.number().optional(),
	color: z.object({
		backgroundColor: z.string().optional(),
		textColor: z.string().optional(),
	}).optional(),
});

export function registerLabelGet(server: McpServer, config: Config): void {
	server.registerTool(
		'label_get',
		{
			title: 'Get label',
			description: 'Get a specific label by ID',
			inputSchema,
			outputSchema,
			annotations: {
				readOnlyHint: true,
			},
		},
		async ({labelId}) => {
			const result = await makeGmailApiCall('GET', `/users/me/labels/${labelId}`, config.token);
			return jsonResult(outputSchema.parse(result));
		},
	);
}

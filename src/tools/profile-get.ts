import {z} from 'zod';
import type {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import type {Config} from './types.js';
import {makeGmailApiCall} from '../utils/gmail-api.js';
import {jsonResult} from '../utils/response.js';
import {strictSchemaWithAliases} from '../utils/schema.js';

const outputSchema = z.object({
	emailAddress: z.string(),
	messagesTotal: z.number().optional(),
	threadsTotal: z.number().optional(),
	historyId: z.string().optional(),
});

export function registerProfileGet(server: McpServer, config: Config): void {
	server.registerTool(
		'get_profile',
		{
			title: 'Get profile',
			description: 'Get the current user\'s Gmail profile including email address',
			inputSchema: strictSchemaWithAliases({}, {}),
			outputSchema,
			annotations: {
				readOnlyHint: true,
			},
		},
		async () => {
			const result = await makeGmailApiCall('GET', '/users/me/profile', config.token);
			return jsonResult(outputSchema.parse(result));
		},
	);
}

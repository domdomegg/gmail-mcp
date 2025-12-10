import {z} from 'zod';
import type {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import type {Config} from './types.js';
import {makeGmailApiCall} from '../utils/gmail-api.js';
import {jsonResult} from '../utils/response.js';

const outputSchema = z.object({
	enableAutoReply: z.boolean(),
	responseSubject: z.string().optional(),
	responseBodyPlainText: z.string().optional(),
	responseBodyHtml: z.string().optional(),
	restrictToContacts: z.boolean().optional(),
	restrictToDomain: z.boolean().optional(),
	startTime: z.string().optional(),
	endTime: z.string().optional(),
});

export function registerVacationGet(server: McpServer, config: Config): void {
	server.registerTool(
		'gmail_vacation_get',
		{
			title: 'Get vacation settings',
			description: 'Get vacation auto-reply settings',
			inputSchema: {},
			outputSchema,
			annotations: {
				readOnlyHint: true,
			},
		},
		async () => {
			const result = await makeGmailApiCall('GET', '/users/me/settings/vacation', config.token);
			return jsonResult(outputSchema.parse(result));
		},
	);
}

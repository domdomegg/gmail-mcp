import {z} from 'zod';
import type {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import type {Config} from './types.js';
import {makeGmailApiCall} from '../utils/gmail-api.js';
import {jsonResult} from '../utils/response.js';

const inputSchema = {
	filterId: z.string().describe('The ID of the filter to delete'),
};

const outputSchema = z.object({
	success: z.literal(true),
	filterId: z.string(),
});

export function registerFilterDelete(server: McpServer, config: Config): void {
	server.registerTool(
		'gmail_filter_delete',
		{
			title: 'Delete filter',
			description: 'Delete an email filter',
			inputSchema,
			outputSchema,
		},
		async ({filterId}) => {
			await makeGmailApiCall('DELETE', `/users/me/settings/filters/${filterId}`, config.token);
			return jsonResult({success: true as const, filterId});
		},
	);
}

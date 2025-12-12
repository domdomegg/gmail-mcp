import {z} from 'zod';
import type {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import type {Config} from './types.js';
import {makeGmailApiCall} from '../utils/gmail-api.js';
import {jsonResult} from '../utils/response.js';

const inputSchema = {
	labelId: z.string().describe('The ID of the label to delete'),
};

const outputSchema = z.object({
	success: z.literal(true),
	labelId: z.string(),
});

export function registerLabelDelete(server: McpServer, config: Config): void {
	server.registerTool(
		'label_delete',
		{
			title: 'Delete label',
			description: 'Delete a label. System labels cannot be deleted.',
			inputSchema,
			outputSchema,
		},
		async ({labelId}) => {
			await makeGmailApiCall('DELETE', `/users/me/labels/${labelId}`, config.token);
			return jsonResult({success: true as const, labelId});
		},
	);
}

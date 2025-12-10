import {z} from 'zod';
import type {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import type {Config} from './types.js';
import {makeGmailApiCall} from '../utils/gmail-api.js';
import {jsonResult} from '../utils/response.js';

const outputSchema = z.object({
	labels: z.array(z.object({
		id: z.string(),
		name: z.string(),
		type: z.enum(['system', 'user']).optional(),
		messageListVisibility: z.enum(['show', 'hide']).optional(),
		labelListVisibility: z.enum(['labelShow', 'labelShowIfUnread', 'labelHide']).optional(),
		messagesTotal: z.number().optional(),
		messagesUnread: z.number().optional(),
		threadsTotal: z.number().optional(),
		threadsUnread: z.number().optional(),
		color: z.object({
			textColor: z.string().optional(),
			backgroundColor: z.string().optional(),
		}).optional(),
	})),
});

export function registerLabelsList(server: McpServer, config: Config): void {
	server.registerTool(
		'labels_list',
		{
			title: 'List labels',
			description: 'List all labels in the user\'s mailbox. Includes both system labels (INBOX, SENT, etc.) and user-created labels.',
			inputSchema: {},
			outputSchema,
			annotations: {
				readOnlyHint: true,
			},
		},
		async () => {
			const result = await makeGmailApiCall('GET', '/users/me/labels', config.token);
			return jsonResult(outputSchema.parse(result));
		},
	);
}

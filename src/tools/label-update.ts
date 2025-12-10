import {z} from 'zod';
import type {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import type {Config} from './types.js';
import {makeGmailApiCall} from '../utils/gmail-api.js';
import {jsonResult} from '../utils/response.js';

const inputSchema = {
	labelId: z.string().describe('The ID of the label to update'),
	name: z.string().optional().describe('New display name for the label'),
	labelListVisibility: z.enum(['labelShow', 'labelShowIfUnread', 'labelHide']).optional().describe('Visibility in label list'),
	messageListVisibility: z.enum(['show', 'hide']).optional().describe('Visibility in message list'),
	backgroundColor: z.string().optional().describe('Background color hex code (e.g., #16a765)'),
	textColor: z.string().optional().describe('Text color hex code (e.g., #ffffff)'),
};

const outputSchema = z.object({
	id: z.string(),
	name: z.string(),
	type: z.string().optional(),
	labelListVisibility: z.string().optional(),
	messageListVisibility: z.string().optional(),
	color: z.object({
		backgroundColor: z.string().optional(),
		textColor: z.string().optional(),
	}).optional(),
});

export function registerLabelUpdate(server: McpServer, config: Config): void {
	server.registerTool(
		'gmail_label_update',
		{
			title: 'Update label',
			description: 'Update an existing label',
			inputSchema,
			outputSchema,
		},
		async ({labelId, name, labelListVisibility, messageListVisibility, backgroundColor, textColor}) => {
			const result = await makeGmailApiCall('PUT', `/users/me/labels/${labelId}`, config.token, {
				id: labelId,
				name,
				labelListVisibility,
				messageListVisibility,
				...(backgroundColor || textColor ? {color: {backgroundColor, textColor}} : {}),
			});
			return jsonResult(outputSchema.parse(result));
		},
	);
}

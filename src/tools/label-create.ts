import {z} from 'zod';
import type {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import type {Config} from './types.js';
import {makeGmailApiCall} from '../utils/gmail-api.js';
import {jsonResult} from '../utils/response.js';

const inputSchema = {
	name: z.string().describe('The display name of the label'),
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

export function registerLabelCreate(server: McpServer, config: Config): void {
	server.registerTool(
		'label_create',
		{
			title: 'Create label',
			description: 'Create a new label',
			inputSchema,
			outputSchema,
		},
		async ({name, labelListVisibility, messageListVisibility, backgroundColor, textColor}) => {
			const result = await makeGmailApiCall('POST', '/users/me/labels', config.token, {
				name,
				labelListVisibility,
				messageListVisibility,
				...(backgroundColor || textColor ? {color: {backgroundColor, textColor}} : {}),
			});
			return jsonResult(outputSchema.parse(result));
		},
	);
}

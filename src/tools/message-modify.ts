import {z} from 'zod';
import type {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import type {Config} from './types.js';
import {makeGmailApiCall} from '../utils/gmail-api.js';
import {jsonResult} from '../utils/response.js';
import {strictSchemaWithAliases} from '../utils/schema.js';

const inputSchema = strictSchemaWithAliases({
	id: z.string().describe('The ID of the message to modify'),
	addLabelIds: z.array(z.string()).optional().describe('Label IDs to add to the message'),
	removeLabelIds: z.array(z.string()).optional().describe('Label IDs to remove from the message'),
}, {});

const outputSchema = z.object({
	id: z.string(),
	threadId: z.string(),
	labelIds: z.array(z.string()).optional(),
});

export function registerMessageModify(server: McpServer, config: Config): void {
	server.registerTool(
		'message_modify',
		{
			title: 'Modify message labels',
			description: 'Modify the labels on a message. Use this to archive (remove INBOX), mark as read (remove UNREAD), star, etc.',
			inputSchema,
			outputSchema,
		},
		async ({id, addLabelIds, removeLabelIds}) => {
			const requestBody: {addLabelIds?: string[]; removeLabelIds?: string[]} = {};
			if (addLabelIds?.length) {
				requestBody.addLabelIds = addLabelIds;
			}

			if (removeLabelIds?.length) {
				requestBody.removeLabelIds = removeLabelIds;
			}

			const result = await makeGmailApiCall('POST', `/users/me/messages/${id}/modify`, config.token, requestBody);
			return jsonResult(outputSchema.parse(result));
		},
	);
}

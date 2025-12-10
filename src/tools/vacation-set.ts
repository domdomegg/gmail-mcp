import {z} from 'zod';
import type {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import type {Config} from './types.js';
import {makeGmailApiCall} from '../utils/gmail-api.js';
import {jsonResult} from '../utils/response.js';

const inputSchema = {
	enableAutoReply: z.boolean().describe('Whether to enable the vacation auto-reply'),
	responseSubject: z.string().optional().describe('Subject line for the auto-reply'),
	responseBodyPlainText: z.string().optional().describe('Plain text body for the auto-reply'),
	responseBodyHtml: z.string().optional().describe('HTML body for the auto-reply'),
	restrictToContacts: z.boolean().optional().describe('Only send to people in contacts'),
	restrictToDomain: z.boolean().optional().describe('Only send to people in the same domain'),
	startTime: z.string().optional().describe('Start time in milliseconds since epoch'),
	endTime: z.string().optional().describe('End time in milliseconds since epoch'),
};

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

export function registerVacationSet(server: McpServer, config: Config): void {
	server.registerTool(
		'gmail_vacation_set',
		{
			title: 'Set vacation settings',
			description: 'Set vacation auto-reply settings. To disable, set enableAutoReply to false.',
			inputSchema,
			outputSchema,
		},
		async ({enableAutoReply, responseSubject, responseBodyPlainText, responseBodyHtml, restrictToContacts, restrictToDomain, startTime, endTime}) => {
			const result = await makeGmailApiCall('PUT', '/users/me/settings/vacation', config.token, {
				enableAutoReply,
				responseSubject,
				responseBodyPlainText,
				responseBodyHtml,
				restrictToContacts,
				restrictToDomain,
				startTime,
				endTime,
			});
			return jsonResult(outputSchema.parse(result));
		},
	);
}

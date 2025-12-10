import {z} from 'zod';
import type {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import type {Config} from './types.js';
import {makeGmailApiCall} from '../utils/gmail-api.js';
import {jsonResult} from '../utils/response.js';

const inputSchema = {
	// Criteria
	from: z.string().optional().describe('Match emails from this sender'),
	to: z.string().optional().describe('Match emails to this recipient'),
	subject: z.string().optional().describe('Match emails with this subject'),
	query: z.string().optional().describe('Match emails matching this query (same as Gmail search)'),
	negatedQuery: z.string().optional().describe('Exclude emails matching this query'),
	hasAttachment: z.boolean().optional().describe('Match emails with attachments'),
	excludeChats: z.boolean().optional().describe('Exclude chat messages'),
	size: z.number().optional().describe('Match emails larger/smaller than this size (bytes)'),
	sizeComparison: z.enum(['larger', 'smaller']).optional().describe('Size comparison operator'),
	// Actions
	addLabelIds: z.array(z.string()).optional().describe('Label IDs to add'),
	removeLabelIds: z.array(z.string()).optional().describe('Label IDs to remove'),
	forward: z.string().optional().describe('Email address to forward to'),
};

const outputSchema = z.object({
	id: z.string(),
	criteria: z.object({
		from: z.string().optional(),
		to: z.string().optional(),
		subject: z.string().optional(),
		query: z.string().optional(),
		negatedQuery: z.string().optional(),
		hasAttachment: z.boolean().optional(),
		excludeChats: z.boolean().optional(),
		size: z.number().optional(),
		sizeComparison: z.string().optional(),
	}).optional(),
	action: z.object({
		addLabelIds: z.array(z.string()).optional(),
		removeLabelIds: z.array(z.string()).optional(),
		forward: z.string().optional(),
	}).optional(),
});

export function registerFilterCreate(server: McpServer, config: Config): void {
	server.registerTool(
		'gmail_filter_create',
		{
			title: 'Create filter',
			description: 'Create a new email filter',
			inputSchema,
			outputSchema,
		},
		async ({from, to, subject, query, negatedQuery, hasAttachment, excludeChats, size, sizeComparison, addLabelIds, removeLabelIds, forward}) => {
			const result = await makeGmailApiCall('POST', '/users/me/settings/filters', config.token, {
				criteria: {
					from,
					to,
					subject,
					query,
					negatedQuery,
					hasAttachment,
					excludeChats,
					size,
					sizeComparison,
				},
				action: {
					addLabelIds,
					removeLabelIds,
					forward,
				},
			});
			return jsonResult(outputSchema.parse(result));
		},
	);
}

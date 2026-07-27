import {
	describe, it, expect, vi, beforeEach,
} from 'vitest';
import {type McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import {makeGmailApiCall} from '../utils/gmail-api.js';
import {registerDraftUpdate} from './draft-update.js';

vi.mock('../utils/gmail-api.js', () => ({
	makeGmailApiCall: vi.fn(),
	GMAIL_API_BASE_URL: 'https://gmail.googleapis.com/gmail/v1',
}));

const apiCall = vi.mocked(makeGmailApiCall);

type Handler = (args: Record<string, unknown>) => Promise<unknown>;

/** The message body of the drafts.update PUT the handler issued. */
const putMessage = (): {raw: string; threadId?: string} => {
	const put = apiCall.mock.calls.find(([method]) => method === 'PUT');
	return (put![3] as {message: {raw: string; threadId?: string}}).message;
};

describe('draft_update', () => {
	let handler: Handler;

	beforeEach(() => {
		apiCall.mockReset();
		const server = {
			registerTool: vi.fn((_name, _meta, h: Handler) => {
				handler = h;
			}),
		} as unknown as McpServer;
		registerDraftUpdate(server, {token: 'test-token'});

		// Default: the draft currently lives in thread-abc, and the update succeeds.
		apiCall.mockImplementation(async (method) => (method === 'GET'
			? {message: {threadId: 'thread-abc'}}
			: {id: 'draft-1', message: {id: 'msg-1', threadId: 'thread-abc'}}));
	});

	it('keeps the draft in its existing thread', async () => {
		await handler({draftId: 'draft-1', body: 'updated'});

		expect(apiCall).toHaveBeenCalledWith('GET', '/users/me/drafts/draft-1?format=minimal', 'test-token');
		expect(putMessage().threadId).toBe('thread-abc');
	});

	it('prefers an explicitly supplied threadId without looking up the draft', async () => {
		await handler({draftId: 'draft-1', body: 'updated', threadId: 'thread-xyz'});

		expect(putMessage().threadId).toBe('thread-xyz');
		expect(apiCall).not.toHaveBeenCalledWith('GET', expect.anything(), expect.anything());
	});

	it('still updates when the draft has no thread', async () => {
		apiCall.mockImplementation(async (method) => (method === 'GET'
			? {message: {}}
			: {id: 'draft-1', message: {id: 'msg-1', threadId: 'thread-new'}}));

		await handler({draftId: 'draft-1', body: 'updated'});

		expect(putMessage()).not.toHaveProperty('threadId');
	});

	it('still updates when the thread lookup fails', async () => {
		apiCall.mockImplementation(async (method) => {
			if (method === 'GET') {
				throw new Error('Gmail API error: 404 Not Found');
			}

			return {id: 'draft-1', message: {id: 'msg-1', threadId: 'thread-new'}};
		});

		await expect(handler({draftId: 'draft-1', body: 'updated'})).resolves.toBeDefined();
		expect(putMessage()).not.toHaveProperty('threadId');
	});
});

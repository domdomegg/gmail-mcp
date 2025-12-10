import {
	describe, it, expect, vi, beforeEach, afterEach,
} from 'vitest';
import {makeGmailApiCall, GMAIL_API_BASE_URL} from './gmail-api.js';

describe('makeGmailApiCall', () => {
	const mockFetch = vi.fn();
	const originalFetch = global.fetch;

	beforeEach(() => {
		global.fetch = mockFetch;
		mockFetch.mockReset();
	});

	afterEach(() => {
		global.fetch = originalFetch;
	});

	it('constructs correct URL from endpoint', async () => {
		mockFetch.mockResolvedValue({
			ok: true,
			headers: new Headers({'content-type': 'application/json'}),
			text: async () => '{"messages": []}',
		});

		await makeGmailApiCall('GET', '/users/me/messages', 'test-token');

		expect(mockFetch).toHaveBeenCalledWith(
			`${GMAIL_API_BASE_URL}/users/me/messages`,
			expect.any(Object),
		);
	});

	it('sets Authorization header with bearer token', async () => {
		mockFetch.mockResolvedValue({
			ok: true,
			headers: new Headers({'content-type': 'application/json'}),
			text: async () => '{}',
		});

		await makeGmailApiCall('GET', '/users/me/messages', 'my-access-token');

		expect(mockFetch).toHaveBeenCalledWith(
			expect.any(String),
			expect.objectContaining({
				headers: expect.objectContaining({
					Authorization: 'Bearer my-access-token',
				}),
			}),
		);
	});

	it('uses specified HTTP method', async () => {
		mockFetch.mockResolvedValue({
			ok: true,
			headers: new Headers({'content-type': 'application/json'}),
			text: async () => '{}',
		});

		await makeGmailApiCall('DELETE', '/users/me/messages/123', 'token');

		expect(mockFetch).toHaveBeenCalledWith(
			expect.any(String),
			expect.objectContaining({method: 'DELETE'}),
		);
	});

	it('sends JSON body when provided', async () => {
		mockFetch.mockResolvedValue({
			ok: true,
			headers: new Headers({'content-type': 'application/json'}),
			text: async () => '{}',
		});

		const body = {addLabelIds: ['INBOX'], removeLabelIds: ['UNREAD']};
		await makeGmailApiCall('POST', '/users/me/messages/123/modify', 'token', body);

		expect(mockFetch).toHaveBeenCalledWith(
			expect.any(String),
			expect.objectContaining({
				headers: expect.objectContaining({
					'Content-Type': 'application/json',
				}),
				body: JSON.stringify(body),
			}),
		);
	});

	it('parses JSON response', async () => {
		const responseData = {messages: [{id: '123', threadId: '456'}]};
		mockFetch.mockResolvedValue({
			ok: true,
			headers: new Headers({'content-type': 'application/json'}),
			text: async () => JSON.stringify(responseData),
		});

		const result = await makeGmailApiCall('GET', '/users/me/messages', 'token');

		expect(result).toEqual(responseData);
	});

	it('returns success object for empty JSON response', async () => {
		mockFetch.mockResolvedValue({
			ok: true,
			headers: new Headers({'content-type': 'application/json'}),
			text: async () => '',
		});

		const result = await makeGmailApiCall('POST', '/users/me/messages/123/trash', 'token');

		expect(result).toEqual({success: true, message: 'Operation completed successfully'});
	});

	it('returns text for non-JSON response', async () => {
		mockFetch.mockResolvedValue({
			ok: true,
			headers: new Headers({'content-type': 'text/plain'}),
			text: async () => 'OK',
		});

		const result = await makeGmailApiCall('GET', '/some/endpoint', 'token');

		expect(result).toBe('OK');
	});

	it('throws on API error response', async () => {
		mockFetch.mockResolvedValue({
			ok: false,
			status: 401,
			statusText: 'Unauthorized',
			text: async () => '{"error": "invalid_token"}',
		});

		await expect(makeGmailApiCall('GET', '/users/me/messages', 'bad-token'))
			.rejects.toThrow('Gmail API error: 401 Unauthorized');
	});

	it('throws on malformed JSON response', async () => {
		mockFetch.mockResolvedValue({
			ok: true,
			headers: new Headers({'content-type': 'application/json'}),
			text: async () => 'not valid json',
		});

		await expect(makeGmailApiCall('GET', '/users/me/messages', 'token'))
			.rejects.toThrow('Failed to parse JSON response');
	});
});

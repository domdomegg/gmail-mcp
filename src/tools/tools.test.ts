import {
	describe, it, expect, vi, beforeEach,
} from 'vitest';
import {type McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import {registerAll} from './index.js';
import type {Config} from './types.js';

// Mock the gmail-api module to avoid real network calls
vi.mock('../utils/gmail-api.js', () => ({
	makeGmailApiCall: vi.fn(),
	GMAIL_API_BASE_URL: 'https://gmail.googleapis.com/gmail/v1',
}));

describe('tool registration', () => {
	let server: McpServer;
	let config: Config;
	let registeredTools: Map<string, {meta: unknown; handler: unknown}>;

	beforeEach(() => {
		registeredTools = new Map();

		// Create a mock server that captures registrations
		server = {
			registerTool: vi.fn((name: string, meta: unknown, handler: unknown) => {
				registeredTools.set(name, {meta, handler});
			}),
		} as unknown as McpServer;

		config = {
			token: 'test-token',
		};

		registerAll(server, config);
	});

	it('registers all expected tools', () => {
		const expectedTools = [
			'messages_list',
			'message_get',
			'message_send',
			'message_modify',
			'message_archive',
			'message_trash',
			'labels_list',
			'draft_create',
			'thread_get',
		];

		for (const toolName of expectedTools) {
			expect(registeredTools.has(toolName), `Tool ${toolName} should be registered`).toBe(true);
		}
	});

	it('registers read-only tools with readOnlyHint annotation', () => {
		const readOnlyTools = ['messages_list', 'message_get', 'labels_list', 'thread_get'];

		for (const toolName of readOnlyTools) {
			const tool = registeredTools.get(toolName);
			expect(tool, `Tool ${toolName} should exist`).toBeDefined();
			const meta = tool!.meta as {annotations?: {readOnlyHint?: boolean}};
			expect(meta.annotations?.readOnlyHint, `Tool ${toolName} should have readOnlyHint: true`).toBe(true);
		}
	});

	it('registers mutating tools without readOnlyHint', () => {
		const mutatingTools = ['message_send', 'message_modify', 'message_archive', 'message_trash', 'draft_create'];

		for (const toolName of mutatingTools) {
			const tool = registeredTools.get(toolName);
			expect(tool, `Tool ${toolName} should exist`).toBeDefined();
			const meta = tool!.meta as {annotations?: {readOnlyHint?: boolean}};
			// Should either not have annotations or readOnlyHint should not be true
			expect(meta.annotations?.readOnlyHint).not.toBe(true);
		}
	});

	it('all tools have title and description', () => {
		for (const [name, tool] of registeredTools) {
			const meta = tool.meta as {title?: string; description?: string};
			expect(meta.title, `Tool ${name} should have a title`).toBeDefined();
			expect(meta.description, `Tool ${name} should have a description`).toBeDefined();
			expect(meta.title!.length, `Tool ${name} title should not be empty`).toBeGreaterThan(0);
			expect(meta.description!.length, `Tool ${name} description should not be empty`).toBeGreaterThan(0);
		}
	});

	it('all tools have input schema', () => {
		for (const [name, tool] of registeredTools) {
			const meta = tool.meta as {inputSchema?: unknown};
			expect(meta.inputSchema, `Tool ${name} should have inputSchema`).toBeDefined();
		}
	});
});

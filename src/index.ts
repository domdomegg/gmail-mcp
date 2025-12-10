import {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import {registerAll, type Config} from './tools/index.js';

// Library exports
export type {Config} from './tools/index.js';

export function createServer(config: Config): McpServer {
	const server = new McpServer({
		name: 'gmail-mcp',
		version: '0.0.1',
	});

	registerAll(server, config);

	return server;
}

import {createRequire} from 'node:module';
import {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import {registerAll, type Config} from './tools/index.js';

// Library exports
export type {Config} from './tools/index.js';

const {version} = createRequire(__filename)('../package.json') as {version: string};

export function createServer(config: Config): McpServer {
	const server = new McpServer({
		name: 'gmail-mcp',
		version,
	});

	registerAll(server, config);

	return server;
}

import {createRequire} from 'node:module';
import {describe, it, expect} from 'vitest';
import {createServer} from './index.js';

const require_ = createRequire(import.meta.url);
const {version: pkgVersion} = require_('../package.json') as {version: string};

describe('createServer', () => {
	it('reports the package.json version, not a hardcoded literal', () => {
		const server = createServer({token: 'test-token'});
		const {version} = (server.server as unknown as {_serverInfo: {version: string}})._serverInfo;
		expect(version).toBe(pkgVersion);
	});
});

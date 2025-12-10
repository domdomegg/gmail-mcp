import type {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import type {Config} from './types.js';
import {registerMessagesList} from './messages-list.js';
import {registerMessageGet} from './message-get.js';
import {registerMessageSend} from './message-send.js';
import {registerMessageModify} from './message-modify.js';
import {registerMessageArchive} from './message-archive.js';
import {registerMessageTrash} from './message-trash.js';
import {registerLabelsList} from './labels-list.js';
import {registerDraftCreate} from './draft-create.js';
import {registerThreadGet} from './thread-get.js';

export type {Config} from './types.js';

export function registerAll(server: McpServer, config: Config): void {
	registerMessagesList(server, config);
	registerMessageGet(server, config);
	registerMessageSend(server, config);
	registerMessageModify(server, config);
	registerMessageArchive(server, config);
	registerMessageTrash(server, config);
	registerLabelsList(server, config);
	registerDraftCreate(server, config);
	registerThreadGet(server, config);
}

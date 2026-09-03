import {routeAgentRequest} from "agents";

export { BrowserAgent } from './BrowserAgent.ts'
export { CodemodeRuntime } from '@cloudflare/codemode'

export default {
  async fetch(request, env) {
    return await routeAgentRequest(request, env) || new Response(null, { status: 404 });
  },
} satisfies ExportedHandler<Env>;

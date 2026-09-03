import {routeAgentRequest} from "agents";

export { BrowserAgent } from './BrowserAgent.ts'
export { CodemodeRuntime } from '@cloudflare/codemode'

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    const screenshotPath = '/api/screenshots/'

    if (request.method === 'GET' && url.pathname.startsWith(screenshotPath)) {
      const key = url.pathname.slice(screenshotPath.length)
      if (!/^[0-9a-f-]{36}\.png$/.test(key)) {
        return new Response(null, {status: 404})
      }

      const screenshot = await env.SEO_SCREENSHOTS.get(key)
      if (!screenshot) {
        return new Response(null, {status: 404})
      }

      const headers = new Headers()
      screenshot.writeHttpMetadata(headers)
      headers.set('etag', screenshot.httpEtag)
      headers.set('cache-control', 'private, max-age=3600')

      return new Response(screenshot.body, {headers})
    }

    return await routeAgentRequest(request, env) || new Response(null, { status: 404 });
  },
} satisfies ExportedHandler<Env>;

import {AIChatAgent} from "@cloudflare/ai-chat";
import {
    convertToModelMessages, createUIMessageStreamResponse, isLoopFinished, streamText, toUIMessageStream
} from "ai";
import {createOpenAICompatible} from "@ai-sdk/openai-compatible";
import puppeteer, {type Browser,type Page} from "@cloudflare/puppeteer";
import {DynamicWorkerExecutor} from "@cloudflare/codemode";
import {createCodeTool} from "@cloudflare/codemode/ai";
import {createPuppeteerTools} from "./tools.ts";

const createHermesModel = (apiKey: string) => {
    const model = createOpenAICompatible({
        name: 'hermes',
        baseURL: 'https://hermes-proxy.apzip.space/v1',
        apiKey
    })

    return model('openai/gpt-oss-120b')
}

const SEO_AUDIT_SYSTEM_PROMPT = `You are an SEO audit agent with access to a real browser through the codemode tool.

When the user provides a URL or asks for an SEO audit:
1. Use codemode to compose the browser tools. Navigate to the URL, inspect SEO, capture a screenshot, and close the browser in a finally block.
2. Return the inspectSeo result and screenshot together from the generated code. Use the score returned by inspectSeo; never calculate or change the score yourself.
3. After the tool finishes, answer in Korean with the score out of 100, the number of passed checks, every failed check and its actual value, and a concrete fix for each failure.
4. Do not invent values that are absent from the tool result. Mention that the captured screenshot is displayed with the tool result.

If an audit is requested without a URL, ask the user for an http:// or https:// URL.`

export class BrowserAgent extends AIChatAgent<Env> {
    browser?: Browser
    page?: Page

    async getPage() {
        if (this.page && this.browser?.connected) {
            return this.page
        }

        this.browser = await puppeteer.launch(this.env.BROWSER)
        this.page = await this.browser.newPage()
        await this.page.setViewport({
            width: 1280,
            height: 720
        })

        return this.page
    }

    async closeBrowser() {
        await this.browser?.close()
        this.browser = undefined
        this.page = undefined
    }

    async onChatMessage() {
        const model = createHermesModel(this.env.API_SERVER_KEY)
        const codemode = createCodeTool({
            tools: [{
                name: "browser",
                tools: createPuppeteerTools({
                    getPage: () => this.getPage(),
                    closeBrowser: () => this.closeBrowser(),
                    saveScreenshot: async data => {
                        const key = `${crypto.randomUUID()}.png`
                        await this.env.SEO_SCREENSHOTS.put(key, data, {
                            httpMetadata: {
                                contentType: 'image/png',
                                cacheControl: 'private, max-age=3600'
                            }
                        })

                        return `/api/screenshots/${key}`
                    }
                })
            }],
            executor: new DynamicWorkerExecutor({loader: this.env.LOADER})
        })

        const result = streamText({
            model,
            system: SEO_AUDIT_SYSTEM_PROMPT,
            messages: await convertToModelMessages(this.messages),
            tools: {codemode},
            stopWhen: isLoopFinished()
        })

        return createUIMessageStreamResponse({
            stream: toUIMessageStream({ stream: result.stream })
        })
    }
}

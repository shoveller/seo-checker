import {AIChatAgent} from "@cloudflare/ai-chat";
import {
    convertToModelMessages,
    createUIMessageStreamResponse, isLoopFinished, streamText, tool, toUIMessageStream
} from "ai";
import {createOpenAICompatible} from "@ai-sdk/openai-compatible";
import {z} from "zod";
import puppeteer, {type Browser,type Page} from "@cloudflare/puppeteer";

const createHermesModel = (apiKey: string) => {
    const model = createOpenAICompatible({
        name: 'hermes',
        baseURL: 'https://hermes-proxy.apzip.space/v1',
        apiKey
    })

    return model('openai/gpt-oss-120b')
}

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

        const result = streamText({
            model,
            messages: await convertToModelMessages(this.messages),
            tools: {
                navigate: tool({
                    description: '웹 페이지로 이동',
                    inputSchema: z.object({ url: z.string().meta({ description: 'https:// 로 시작하는 웹페이지 주소' }) }),
                    execute: async ({ url }) => {
                        const page = await this.getPage()
                        await page.goto(url)
                        return { ok: true, title: await page.title() }
                    }
                }),
                closeBrowser: tool({
                    description: "Close the browser session",
                    inputSchema: z.object({}),
                    execute: async () => {
                        await this.closeBrowser();
                        return { ok: true };
                    },
                }),
            },
            stopWhen: isLoopFinished()
        })

        return createUIMessageStreamResponse({
            stream: toUIMessageStream({ stream: result.stream })
        })
    }
}
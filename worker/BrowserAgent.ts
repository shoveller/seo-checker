import {AIChatAgent} from "@cloudflare/ai-chat";
import {
    convertToModelMessages,
    createUIMessageStreamResponse, streamText, toUIMessageStream
} from "ai";
import {createOpenAICompatible} from "@ai-sdk/openai-compatible";

const createHermesModel = (apiKey: string) => {
    const model = createOpenAICompatible({
        name: 'hermes',
        baseURL: 'https://hermes-proxy.apzip.space/v1',
        apiKey
    })

    return model('openai/gpt-oss-120b')
}

export class BrowserAgent extends AIChatAgent<Env> {
    async onChatMessage() {
        const model = createHermesModel(this.env.API_SERVER_KEY)
        const result = streamText({
            model,
            messages: await convertToModelMessages(this.messages)
        })

        return createUIMessageStreamResponse({
            stream: toUIMessageStream({ stream: result.stream })
        })
    }
}
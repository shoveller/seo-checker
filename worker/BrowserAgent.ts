import {AIChatAgent} from "@cloudflare/ai-chat";
import {
    createUIMessageStream,
    createUIMessageStreamResponse
} from "ai";

export class BrowserAgent extends AIChatAgent<Env> {
    async onChatMessage() {
        console.log('hel')
        return createUIMessageStreamResponse({
            stream: createUIMessageStream({
                execute({ writer }){
                    writer.write({ type: 'text-start', id: 'answer' })
                    writer.write({ type: 'text-delta', id: 'answer', delta: 'hello' })
                    writer.write({ type: 'text-end', id: 'answer' })
                }
            })
        })
    }
}
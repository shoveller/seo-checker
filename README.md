# [브라우저_CDP 코드모드](https://developers.cloudflare.com/agents/tools/browser/)
```shell
pnpm i @ai-sdk/openai-compatible @ai-sdk/react @cloudflare/ai-chat @cloudflare/codemode agents ai zod
```

- 다이나믹 워커를 활성화하기 위해 LOADER 바인딩을 추가한다.
- 브라우저 바인딩도 추가한다. 원격 브라우저에서만 쓸수 있는 도구를 사용하기 위해 `remote: true` 를 활성화한다.
```json
{
  "durable_objects": {
    "bindings": [{
      "name": "BrowserAgent",
      "class_name": "BrowserAgent"
    }]
  },
  "migrations": [{
    "tag": "v1",
    "new_sqlite_classes": ["BrowserAgent"]
  }],
  "secrets": {
    "required": ["API_SERVER_KEY"]
  },
  "browser": {
    "binding": "BROWSER",
    "remote": true
  },
  "worker_loaders": [{
    "binding": "LOADER"
  }]
}
```

- 에이전트의 브라우저 툴 구현은 아래와 같다. 
- createBrowserTools 함수는 CDP도구를 codemode 기술을 사용해서 최적화한 형태로 내보낸다.
```ts
import {AIChatAgent} from "@cloudflare/ai-chat";
import {
    convertToModelMessages,
    createUIMessageStreamResponse, isLoopFinished, streamText, toUIMessageStream
} from "ai";
import {createOpenAICompatible} from "@ai-sdk/openai-compatible";
import {createBrowserTools} from "agents/browser/ai";

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
        const browserTool = createBrowserTools({
            browser: this.env.BROWSER,
            loader: this.env.LOADER
        })
        const result = streamText({
            model,
            messages: await convertToModelMessages(this.messages),
            tools: {
                ...browserTool
            },
            stopWhen: isLoopFinished()
        })

        return createUIMessageStreamResponse({
            stream: toUIMessageStream({ stream: result.stream })
        })
    }
}
```
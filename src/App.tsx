import './App.css'
import {useAgent} from "agents/react";
import {useAgentChat} from "agents/chat/react";
import {getToolName, isToolUIPart} from "ai";
import {useEffect, useRef, useState} from "react";
import type {FormEvent} from "react";

const toolStateLabels = {
  'input-streaming': '인수 생성 중',
  'input-available': '실행 대기',
  'approval-requested': '승인 대기',
  'approval-responded': '승인됨',
  'output-available': '완료',
  'output-error': '오류',
  'output-denied': '거부됨',
} as const

function formatToolValue(value: unknown) {
  if (typeof value === 'string') return value

  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

function App() {
  const agent = useAgent({ agent: 'BrowserAgent' })
  const { sendMessage, messages, status, error } = useAgentChat({ agent })
  const [input, setInput] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const isBusy = status === 'submitted' || status === 'streaming'

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: status === 'streaming' ? 'auto' : 'smooth',
      block: 'end',
    })
  }, [messages, status])

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const text = input.trim()
    if (!text || isBusy) return

    void sendMessage({ text })
    setInput('')
  }

  return (
    <main className="chat-app">
      <header className="chat-header">
        <div>
          <span className="chat-eyebrow">SEO CHECKER</span>
          <h1>Browser Agent</h1>
        </div>
        <div className={`chat-status chat-status--${status}`}>
          <span aria-hidden="true" />
          {status === 'ready' && '대기'}
          {status === 'submitted' && '연결 중'}
          {status === 'streaming' && '응답 중'}
          {status === 'error' && '오류'}
        </div>
      </header>

      <section className="messages" role="log" aria-live="polite" aria-label="채팅 내역">
        {messages.length === 0 && (
          <div className="empty-state">
            <span aria-hidden="true">01</span>
            <h2>무엇을 확인할까요?</h2>
            <p>요청을 입력하면 답변과 툴 실행 이력이 여기에 표시됩니다.</p>
          </div>
        )}

        {messages.map((message) => (
          <article className={`message message--${message.role}`} key={message.id}>
            <div className="message-role">
              {message.role === 'user' ? 'YOU' : message.role === 'assistant' ? 'AGENT' : message.role.toUpperCase()}
            </div>
            <div className="message-content">
              {message.parts.map((part, index) => {
                if (part.type === 'text') {
                  return part.text ? <p key={index}>{part.text}</p> : null
                }

                if (isToolUIPart(part)) {
                  return (
                    <details className="tool-call" data-state={part.state} key={part.toolCallId}>
                      <summary>
                        <span className="tool-mark" aria-hidden="true">↳</span>
                        <span className="tool-name">{getToolName(part)}</span>
                        <span className="tool-state">{toolStateLabels[part.state]}</span>
                      </summary>
                      <div className="tool-details">
                        {part.input !== undefined && (
                          <div>
                            <span>INPUT</span>
                            <pre>{formatToolValue(part.input)}</pre>
                          </div>
                        )}
                        {part.state === 'output-available' && (
                          <div>
                            <span>OUTPUT</span>
                            <pre>{formatToolValue(part.output)}</pre>
                          </div>
                        )}
                        {part.state === 'output-error' && (
                          <div>
                            <span>ERROR</span>
                            <pre>{part.errorText}</pre>
                          </div>
                        )}
                        {part.state === 'output-denied' && (
                          <p className="tool-denied">사용자가 이 툴 호출을 거부했습니다.</p>
                        )}
                      </div>
                    </details>
                  )
                }

                return null
              })}
            </div>
          </article>
        ))}

        {error && <p className="chat-error">응답을 가져오지 못했습니다: {error.message}</p>}
        <div ref={messagesEndRef} />
      </section>

      <form className="composer" onSubmit={handleSubmit}>
        <label htmlFor="chat-input">메시지</label>
        <textarea
          id="chat-input"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault()
              event.currentTarget.form?.requestSubmit()
            }
          }}
          placeholder="분석할 내용을 입력하세요"
          rows={1}
          disabled={isBusy}
        />
        <button type="submit" disabled={!input.trim() || isBusy}>
          {isBusy ? '진행 중' : '보내기'}
        </button>
      </form>
    </main>
  )
}

export default App

import './App.css'
import {useAgent} from "agents/react";
import {useAgentChat} from "agents/chat/react";
import {useEffect} from "react";

function App() {
  const agent = useAgent({ agent: 'BrowserAgent' })
  const { sendMessage, messages } = useAgentChat({ agent })

  useEffect(() => {
    sendMessage({ text: 'hello' })
    // alert()
  }, [sendMessage]);


  return (
      <>{JSON.stringify(messages)}</>
  )
}

export default App

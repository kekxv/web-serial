import { useEffect, useRef } from 'react'
import './Terminal.css'

export interface TerminalMessage {
  id: string
  timestamp: string
  data: string
  direction: 'rx' | 'tx'
}

interface TerminalProps {
  messages: TerminalMessage[]
  hexMode: boolean
  onClear?: () => void
  onCopy?: () => void
  autoScroll?: boolean
}

const Terminal: React.FC<TerminalProps> = ({
  messages,
  hexMode,
  onClear,
  onCopy,
  autoScroll = true,
}) => {
  const terminalRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (autoScroll && terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight
    }
  }, [messages, autoScroll])

  const formatData = (data: string) => {
    if (hexMode) {
      try {
        return data
          .split('')
          .map((char) => char.charCodeAt(0).toString(16).padStart(2, '0'))
          .join(' ')
          .toUpperCase()
      } catch {
        return data
      }
    }
    return data
  }

  const getDirectionClass = (direction: 'rx' | 'tx') => {
    return direction === 'rx' ? 'message-rx' : 'message-tx'
  }

  const getDirectionIcon = (direction: 'rx' | 'tx') => {
    return direction === 'rx' ? 'bi-arrow-down' : 'bi-arrow-up'
  }

  const getDirectionText = (direction: 'rx' | 'tx') => {
    return direction === 'rx' ? 'RX' : 'TX'
  }

  return (
    <div className="terminal-container">
      <div className="terminal-header">
        <h6 className="mb-0">
          <i className="bi bi-terminal me-2"></i>
          终端
        </h6>
        <div className="terminal-actions">
          <button
            className="btn btn-sm btn-outline-secondary me-2"
            onClick={onCopy}
            title="复制全部"
          >
            <i className="bi bi-clipboard"></i>
          </button>
          <button
            className="btn btn-sm btn-outline-danger"
            onClick={onClear}
            title="清空"
          >
            <i className="bi bi-trash"></i>
          </button>
        </div>
      </div>
      <div ref={terminalRef} className="terminal-content custom-scrollbar">
        {messages.length === 0 ? (
          <div className="terminal-empty">
            <i className="bi bi-chat-quote"></i>
            <p>暂无消息</p>
          </div>
        ) : (
          messages.map((message) => (
            <div key={message.id} className={`terminal-message ${getDirectionClass(message.direction)}`}>
              <div className="message-meta">
                <span className="message-direction">
                  <i className={`bi ${getDirectionIcon(message.direction)}`}></i>
                  {getDirectionText(message.direction)}
                </span>
                <span className="message-timestamp">{message.timestamp}</span>
              </div>
              <div className="message-data">{formatData(message.data)}</div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export default Terminal

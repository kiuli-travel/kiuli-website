'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react'

interface ConversationAction {
  type: string
  field?: string
  sectionName?: string
  before?: string
  after?: string
  details?: Record<string, unknown>
}

interface ConversationMessage {
  role: 'designer' | 'kiuli'
  content: string
  timestamp: string
  actions?: ConversationAction[]
}

interface ConversationPanelProps {
  projectId: number
  initialMessages?: ConversationMessage[]
  onActionApplied?: () => void
}

function formatTimestamp(ts: string): string {
  try {
    const d = new Date(ts)
    return d.toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return ''
  }
}

function actionLabel(action: ConversationAction): string {
  switch (action.type) {
    case 'edit_field':
      return `Edited ${action.field || 'field'}`
    case 'rewrite_section':
      return `Updated ${action.sectionName || 'section'}`
    case 'stage_change':
      return `Stage: ${action.before} → ${action.after}`
    case 'trigger_research':
      return 'Triggered research'
    case 'trigger_draft':
      return 'Triggered draft'
    default:
      return action.type
  }
}

export default function ConversationPanel({
  projectId,
  initialMessages = [],
  onActionApplied,
}: ConversationPanelProps) {
  const [messages, setMessages] = useState<ConversationMessage[]>(initialMessages)
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    setMessages(initialMessages)
  }, [initialMessages])

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  const handleSend = async () => {
    const text = inputValue.trim()
    if (!text || isLoading) return

    setError(null)
    setInputValue('')

    // Optimistically add designer message
    const designerMsg: ConversationMessage = {
      role: 'designer',
      content: text,
      timestamp: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, designerMsg])
    setIsLoading(true)

    try {
      const res = await fetch('/api/content/conversation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ projectId, message: text }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || `Request failed (${res.status})`)
      }

      const kiuliMsg: ConversationMessage = {
        role: 'kiuli',
        content: data.response.message,
        timestamp: new Date().toISOString(),
        actions:
          data.response.actions?.length > 0
            ? data.response.actions
            : undefined,
      }
      setMessages((prev) => [...prev, kiuliMsg])

      if (data.response.actions?.length > 0 && onActionApplied) {
        onActionApplied()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setIsLoading(false)
      textareaRef.current?.focus()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: '400px',
        backgroundColor: '#FAFAF8',
        borderRadius: '8px',
        border: '1px solid #E5E2DA',
        overflow: 'hidden',
      }}
    >
      {/* Messages area */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        {messages.length === 0 && (
          <div
            style={{
              textAlign: 'center',
              color: '#999',
              padding: '40px 20px',
              fontSize: '14px',
            }}
          >
            Start a conversation about this project...
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              justifyContent:
                msg.role === 'designer' ? 'flex-end' : 'flex-start',
            }}
          >
            <div
              style={{
                maxWidth: '75%',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
              }}
            >
              <div
                style={{
                  padding: '10px 14px',
                  borderRadius:
                    msg.role === 'designer'
                      ? '14px 14px 4px 14px'
                      : '14px 14px 14px 4px',
                  backgroundColor:
                    msg.role === 'designer' ? '#486A6A' : '#F5F3EB',
                  color: msg.role === 'designer' ? '#fff' : '#404040',
                  fontSize: '14px',
                  lineHeight: '1.5',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
              >
                {msg.content}
              </div>

              {/* Action badges */}
              {msg.actions && msg.actions.length > 0 && (
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '4px',
                    paddingLeft: '4px',
                  }}
                >
                  {msg.actions.map((action, j) => (
                    <span
                      key={j}
                      style={{
                        display: 'inline-block',
                        padding: '2px 8px',
                        borderRadius: '10px',
                        backgroundColor: '#FDF2ED',
                        color: '#DA7A5A',
                        fontSize: '11px',
                        fontWeight: 500,
                      }}
                    >
                      {actionLabel(action)}
                    </span>
                  ))}
                </div>
              )}

              {/* Timestamp */}
              <div
                style={{
                  fontSize: '11px',
                  color: '#999',
                  paddingLeft: msg.role === 'kiuli' ? '4px' : undefined,
                  paddingRight: msg.role === 'designer' ? '4px' : undefined,
                  textAlign: msg.role === 'designer' ? 'right' : 'left',
                }}
              >
                {msg.role === 'kiuli' ? 'Kiuli' : 'You'} &middot;{' '}
                {formatTimestamp(msg.timestamp)}
              </div>
            </div>
          </div>
        ))}

        {/* Typing indicator */}
        {isLoading && (
          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <div
              style={{
                padding: '10px 14px',
                borderRadius: '14px 14px 14px 4px',
                backgroundColor: '#F5F3EB',
                color: '#999',
                fontSize: '14px',
              }}
            >
              <span style={{ animation: 'pulse 1.5s infinite' }}>
                Kiuli is thinking...
              </span>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div
            style={{
              padding: '8px 12px',
              borderRadius: '8px',
              backgroundColor: '#FEE',
              color: '#C33',
              fontSize: '13px',
              textAlign: 'center',
            }}
          >
            {error}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div
        style={{
          borderTop: '1px solid #E5E2DA',
          padding: '12px 16px',
          backgroundColor: '#fff',
          display: 'flex',
          gap: '8px',
          alignItems: 'flex-end',
        }}
      >
        <textarea
          ref={textareaRef}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isLoading}
          placeholder="Type a message..."
          rows={1}
          style={{
            flex: 1,
            padding: '10px 12px',
            border: '1px solid #E5E2DA',
            borderRadius: '8px',
            fontSize: '14px',
            lineHeight: '1.5',
            resize: 'none',
            outline: 'none',
            fontFamily: 'inherit',
            minHeight: '40px',
            maxHeight: '120px',
            backgroundColor: isLoading ? '#f5f5f5' : '#fff',
          }}
          onInput={(e) => {
            const el = e.currentTarget
            el.style.height = 'auto'
            el.style.height = Math.min(el.scrollHeight, 120) + 'px'
          }}
        />
        <button
          onClick={handleSend}
          disabled={isLoading || !inputValue.trim()}
          style={{
            padding: '10px 20px',
            borderRadius: '8px',
            border: 'none',
            backgroundColor:
              isLoading || !inputValue.trim() ? '#ccc' : '#DA7A5A',
            color: '#fff',
            fontSize: '14px',
            fontWeight: 600,
            cursor: isLoading || !inputValue.trim() ? 'default' : 'pointer',
            transition: 'background-color 0.2s',
            whiteSpace: 'nowrap',
          }}
          onMouseEnter={(e) => {
            if (!isLoading && inputValue.trim()) {
              e.currentTarget.style.backgroundColor = '#c46a4d'
            }
          }}
          onMouseLeave={(e) => {
            if (!isLoading && inputValue.trim()) {
              e.currentTarget.style.backgroundColor = '#DA7A5A'
            }
          }}
        >
          Send
        </button>
      </div>
    </div>
  )
}

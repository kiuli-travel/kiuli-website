'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Send, Loader2 } from 'lucide-react'
import { sendConversationMessage } from '@/app/(payload)/admin/content-engine/project/[id]/actions'
import type { ConversationMessage, MessageAction } from '../workspace-types'

// ── Formatting helpers ───────────────────────────────────────────────────────

function formatTime(timestamp: string): string {
  try {
    const d = new Date(timestamp)
    const h = d.getUTCHours().toString().padStart(2, '0')
    const m = d.getUTCMinutes().toString().padStart(2, '0')
    return `${h}:${m}`
  } catch {
    return ''
  }
}

function formatDate(timestamp: string): string {
  try {
    const d = new Date(timestamp)
    const months = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
    ]
    return `${months[d.getUTCMonth()]} ${d.getUTCDate()}`
  } catch {
    return ''
  }
}

const actionLabels: Record<string, string> = {
  edit_field: 'Edited',
  edit_section: 'Updated',
  rewrite_section: 'Updated',
  add_item: 'Added',
  stage_change: 'Stage',
  trigger_research: 'Research',
  trigger_draft: 'Draft',
}

function formatActionLabel(action: MessageAction): string {
  const verb = actionLabels[action.type] || action.type
  if (action.field) {
    const fieldLabel = action.field
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, (s) => s.toUpperCase())
      .trim()
    return `${verb} ${fieldLabel}`
  }
  if (action.sectionName) {
    return `${verb} ${action.sectionName}`
  }
  if (action.before && action.after) {
    return `${verb}: ${action.before} → ${action.after}`
  }
  return verb
}

// ── Component ────────────────────────────────────────────────────────────────

interface ConversationPanelProps {
  projectId: number
  initialMessages?: ConversationMessage[]
  onActionApplied?: () => void
  inputValue?: string
  onInputChange?: (value: string) => void
  activeTab?: string
}

export function ConversationPanel({
  projectId,
  initialMessages = [],
  onActionApplied,
  inputValue: externalInput,
  onInputChange: externalOnInputChange,
  activeTab,
}: ConversationPanelProps) {
  const [messages, setMessages] = useState<ConversationMessage[]>(initialMessages)
  const [internalInput, setInternalInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Use external input/onChange if provided, otherwise internal state
  const inputValue = externalInput !== undefined ? externalInput : internalInput
  const setInputValue = externalOnInputChange || setInternalInput

  useEffect(() => {
    setMessages(initialMessages)
  }, [initialMessages])

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, isLoading])

  const handleSend = useCallback(async () => {
    const text = inputValue.trim()
    if (!text || isLoading) return

    setError(null)
    setInputValue('')

    // Optimistic designer message
    const designerMsg: ConversationMessage = {
      role: 'designer',
      content: text,
      timestamp: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, designerMsg])
    setIsLoading(true)

    try {
      const result = await sendConversationMessage(projectId, text, activeTab)

      if ('error' in result && result.error) {
        setError(result.error)
      } else if ('response' in result && result.response) {
        const kiuliMsg: ConversationMessage = {
          role: 'kiuli',
          content: result.response.message,
          timestamp: new Date().toISOString(),
          actions: result.response.actions?.length > 0 ? result.response.actions : undefined,
          suggestedNextStep: result.response.suggestedNextStep || undefined,
        }
        setMessages((prev) => [...prev, kiuliMsg])

        if (result.response.actions?.length > 0 && onActionApplied) {
          onActionApplied()
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setIsLoading(false)
      textareaRef.current?.focus()
    }
  }, [inputValue, isLoading, projectId, setInputValue, onActionApplied, activeTab])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSend()
      }
    },
    [handleSend],
  )

  return (
    <div className="flex h-full w-full flex-col bg-kiuli-ivory/40">
      {/* Header */}
      <div className="flex shrink-0 items-center border-b border-kiuli-gray/60 px-4 py-3">
        <h3 className="text-sm font-semibold text-kiuli-charcoal">Conversation</h3>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4">
        <div className="flex flex-col gap-4">
          {messages.length === 0 && !isLoading && (
            <div className="py-12 text-center text-sm text-kiuli-charcoal/40">
              Start a conversation about this project...
            </div>
          )}

          {messages.map((msg, idx) => {
            const isDesigner = msg.role === 'designer'
            const showDate =
              idx === 0 ||
              formatDate(msg.timestamp) !== formatDate(messages[idx - 1].timestamp)

            return (
              <div key={idx}>
                {showDate && (
                  <div className="mb-3 flex justify-center">
                    <span className="rounded-full bg-kiuli-gray/30 px-3 py-0.5 text-[10px] font-medium text-kiuli-charcoal/40">
                      {formatDate(msg.timestamp)}
                    </span>
                  </div>
                )}
                <div className={`flex ${isDesigner ? 'justify-end' : 'justify-start'}`}>
                  <div className="flex max-w-[85%] flex-col gap-1">
                    {/* Message bubble */}
                    <div
                      className={`px-3.5 py-2.5 text-sm leading-relaxed ${
                        isDesigner
                          ? 'rounded-tl-[12px] rounded-tr-[12px] rounded-bl-[12px] rounded-br-[4px] bg-kiuli-teal text-white'
                          : 'rounded-tl-[4px] rounded-tr-[12px] rounded-bl-[12px] rounded-br-[12px] bg-kiuli-ivory text-kiuli-charcoal'
                      }`}
                      style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
                    >
                      {msg.content}
                    </div>

                    {/* Action badges */}
                    {msg.actions && msg.actions.length > 0 && (
                      <div
                        className={`flex flex-wrap gap-1.5 ${
                          isDesigner ? 'justify-end' : 'justify-start'
                        }`}
                      >
                        {msg.actions.map((action, i) => (
                          <span
                            key={i}
                            className="rounded-full bg-kiuli-clay/10 px-2.5 py-0.5 text-[11px] font-medium text-kiuli-clay"
                          >
                            {formatActionLabel(action)}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Suggested next step */}
                    {msg.suggestedNextStep && (
                      <p
                        className={`text-[11px] italic leading-relaxed text-kiuli-charcoal/40 ${
                          isDesigner ? 'text-right' : 'text-left'
                        }`}
                      >
                        {msg.suggestedNextStep}
                      </p>
                    )}

                    {/* Timestamp */}
                    <span
                      className={`text-[10px] text-kiuli-charcoal/30 ${
                        isDesigner ? 'text-right' : 'text-left'
                      }`}
                    >
                      {formatTime(msg.timestamp)}
                    </span>
                  </div>
                </div>
              </div>
            )
          })}

          {/* Typing indicator */}
          {isLoading && (
            <div className="flex justify-start">
              <div className="rounded-tl-[4px] rounded-tr-[12px] rounded-bl-[12px] rounded-br-[12px] bg-kiuli-ivory px-3.5 py-2.5">
                <span className="flex items-center gap-2 text-sm text-kiuli-charcoal/50">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Kiuli is thinking...
                </span>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="rounded bg-red-50 px-3 py-2 text-center text-xs text-red-600">
              {error}
            </div>
          )}
        </div>
      </div>

      {/* Input */}
      <div className="shrink-0 border-t border-kiuli-gray/60 p-3">
        <div className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
            placeholder="Type a message..."
            rows={1}
            className="flex-1 resize-none rounded border border-kiuli-gray bg-white px-3 py-2 text-sm text-kiuli-charcoal placeholder:text-kiuli-charcoal/40 focus:border-kiuli-teal focus:outline-none focus:ring-1 focus:ring-kiuli-teal disabled:bg-kiuli-ivory/50"
            style={{ maxHeight: 120 }}
            onInput={(e) => {
              const el = e.currentTarget
              el.style.height = 'auto'
              el.style.height = Math.min(el.scrollHeight, 120) + 'px'
            }}
          />
          <button
            onClick={handleSend}
            disabled={!inputValue.trim() || isLoading}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded border-0 bg-kiuli-clay text-white transition-colors hover:bg-kiuli-clay/90 disabled:opacity-40"
            aria-label="Send message"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

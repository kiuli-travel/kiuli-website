// V0 Reference — ConversationPanel (VISUAL DESIGN ONLY)
// This is the v0 mock version. CLI must MERGE this visual design with
// the Phase 9 server action logic from src/components/content-system/ConversationPanel.tsx
// Key: keep Tailwind styling from this file, keep API logic from Phase 9 file.

"use client"

import { useState, useRef, useEffect } from "react"
import { Send } from "lucide-react"
import type { ConversationMessage } from "@/lib/workspace-data"

function formatTime(timestamp: string): string {
  const d = new Date(timestamp)
  const h = d.getUTCHours().toString().padStart(2, "0")
  const m = d.getUTCMinutes().toString().padStart(2, "0")
  return `${h}:${m}`
}

function formatDate(timestamp: string): string {
  const d = new Date(timestamp)
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ]
  return `${months[d.getUTCMonth()]} ${d.getUTCDate()}`
}

const actionLabels: Record<string, string> = {
  edit_field: "Edited",
  edit_section: "Updated",
  add_item: "Added",
}

interface ConversationPanelProps {
  messages: ConversationMessage[]
  onSendMessage: (content: string) => void
  inputValue: string
  onInputChange: (value: string) => void
}

export function ConversationPanel({
  messages,
  onSendMessage,
  inputValue,
  onInputChange,
}: ConversationPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  function handleSend() {
    if (!inputValue.trim()) return
    onSendMessage(inputValue.trim())
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="flex h-full flex-col bg-kiuli-ivory/40">
      {/* Header */}
      <div className="flex shrink-0 items-center border-b border-kiuli-gray/60 px-4 py-3">
        <h3 className="text-sm font-semibold text-kiuli-charcoal">
          Conversation
        </h3>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-4"
      >
        <div className="flex flex-col gap-4">
          {messages.map((msg, idx) => {
            const isDesigner = msg.role === "designer"
            const showDate =
              idx === 0 ||
              formatDate(msg.timestamp) !==
                formatDate(messages[idx - 1].timestamp)

            return (
              <div key={msg.id}>
                {showDate && (
                  <div className="mb-3 flex justify-center">
                    <span className="rounded-full bg-kiuli-gray/30 px-3 py-0.5 text-[10px] font-medium text-kiuli-charcoal/40">
                      {formatDate(msg.timestamp)}
                    </span>
                  </div>
                )}
                <div
                  className={`flex ${
                    isDesigner ? "justify-end" : "justify-start"
                  }`}
                >
                  <div className="flex max-w-[85%] flex-col gap-1">
                    <div
                      className={`px-3.5 py-2.5 text-sm leading-relaxed ${
                        isDesigner
                          ? "rounded-tl-[12px] rounded-tr-[12px] rounded-bl-[12px] rounded-br-[4px] bg-kiuli-teal text-white"
                          : "rounded-tl-[4px] rounded-tr-[12px] rounded-bl-[12px] rounded-br-[12px] bg-kiuli-ivory text-kiuli-charcoal"
                      }`}
                    >
                      {msg.content}
                    </div>

                    {/* Action badges */}
                    {msg.actions && msg.actions.length > 0 && (
                      <div
                        className={`flex flex-wrap gap-1.5 ${
                          isDesigner ? "justify-end" : "justify-start"
                        }`}
                      >
                        {msg.actions.map((action, i) => (
                          <span
                            key={i}
                            className="rounded-full bg-kiuli-clay/10 px-2.5 py-0.5 text-[11px] font-medium text-kiuli-clay"
                          >
                            {actionLabels[action.type] || action.type}{" "}
                            {action.field
                              .replace(/([A-Z])/g, " $1")
                              .replace(/^./, (s) => s.toUpperCase())
                              .trim()}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Suggested next step */}
                    {msg.suggestedNextStep && (
                      <p
                        className={`text-[11px] italic leading-relaxed text-kiuli-charcoal/40 ${
                          isDesigner ? "text-right" : "text-left"
                        }`}
                      >
                        {msg.suggestedNextStep}
                      </p>
                    )}

                    {/* Timestamp */}
                    <span
                      className={`text-[10px] text-kiuli-charcoal/30 ${
                        isDesigner ? "text-right" : "text-left"
                      }`}
                    >
                      {formatTime(msg.timestamp)}
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Input */}
      <div className="shrink-0 border-t border-kiuli-gray/60 p-3">
        <div className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            value={inputValue}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            rows={1}
            className="flex-1 resize-none rounded border border-kiuli-gray bg-white px-3 py-2 text-sm text-kiuli-charcoal placeholder:text-kiuli-charcoal/40 focus:border-kiuli-teal focus:outline-none focus:ring-1 focus:ring-kiuli-teal"
            style={{ maxHeight: 120 }}
          />
          <button
            onClick={handleSend}
            disabled={!inputValue.trim()}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-kiuli-clay text-white transition-colors hover:bg-kiuli-clay/90 disabled:opacity-40"
            aria-label="Send message"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

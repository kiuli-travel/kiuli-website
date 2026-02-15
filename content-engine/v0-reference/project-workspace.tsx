// V0 Reference — ProjectWorkspace
// Copy of the v0 output. CLI should adapt this for real data integration.
// Key changes needed: replace mock data with server-fetched data, replace mock
// conversation with real server action, wire advance/save/research buttons to server actions.

"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { WorkspaceHeader } from "./workspace-header"
import { ConversationPanel } from "./conversation-panel"
import {
  BriefTab,
  ResearchTab,
  DraftTab,
  FAQTab,
  ImagesTab,
  DistributionTab,
  MetadataTab,
} from "./content-tabs"
import {
  getTabsForContentType,
  isArticleType,
  type WorkspaceProject,
} from "@/lib/workspace-data"

interface ProjectWorkspaceProps {
  project: WorkspaceProject
  onBack: () => void
}

export function ProjectWorkspace({ project, onBack }: ProjectWorkspaceProps) {
  const [currentProject, setCurrentProject] =
    useState<WorkspaceProject>(project)
  const tabs = getTabsForContentType(currentProject.contentType)
  const [activeTab, setActiveTab] = useState(tabs[0])
  const [inputValue, setInputValue] = useState("")

  // Draggable divider
  const [leftPercent, setLeftPercent] = useState(60)
  const isDragging = useRef(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setCurrentProject(project)
    const newTabs = getTabsForContentType(project.contentType)
    setActiveTab(newTabs[0])
  }, [project])

  const handleMouseDown = useCallback(() => {
    isDragging.current = true
    document.body.style.cursor = "col-resize"
    document.body.style.userSelect = "none"
  }, [])

  useEffect(() => {
    function handleMouseMove(e: MouseEvent) {
      if (!isDragging.current || !containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      const pct = ((e.clientX - rect.left) / rect.width) * 100
      setLeftPercent(Math.min(75, Math.max(40, pct)))
    }
    function handleMouseUp() {
      isDragging.current = false
      document.body.style.cursor = ""
      document.body.style.userSelect = ""
    }
    document.addEventListener("mousemove", handleMouseMove)
    document.addEventListener("mouseup", handleMouseUp)
    return () => {
      document.removeEventListener("mousemove", handleMouseMove)
      document.removeEventListener("mouseup", handleMouseUp)
    }
  }, [])

  function handleSendMessage(content: string) {
    const newMsg = {
      id: `msg_local_${Date.now()}`,
      role: "designer" as const,
      content,
      timestamp: new Date().toISOString(),
    }
    setCurrentProject((prev) => ({
      ...prev,
      messages: [...prev.messages, newMsg],
    }))
    setInputValue("")
  }

  function handleTitleChange(title: string) {
    setCurrentProject((prev) => ({ ...prev, title }))
  }

  function handleAdvance() {
    // Mock: would advance stage in real app
  }

  function handleFocusSection(sectionName: string) {
    setInputValue(`Let's work on the ${sectionName} section`)
  }

  function renderTabContent() {
    switch (activeTab) {
      case "Brief":
        return <BriefTab project={currentProject} />
      case "Research":
        return <ResearchTab project={currentProject} />
      case "Draft":
        return (
          <DraftTab
            project={currentProject}
            onFocusSection={handleFocusSection}
          />
        )
      case "FAQ":
        return <FAQTab project={currentProject} />
      case "Images":
        return <ImagesTab />
      case "Distribution":
        return <DistributionTab project={currentProject} />
      case "Metadata":
        return <MetadataTab project={currentProject} />
      case "Current vs Proposed":
        return (
          <DraftTab
            project={currentProject}
            onFocusSection={handleFocusSection}
          />
        )
      default:
        return (
          <div className="flex items-center justify-center py-16 text-sm text-kiuli-charcoal/50">
            Tab content not available.
          </div>
        )
    }
  }

  return (
    <div className="flex h-screen flex-col bg-white">
      {/* Header */}
      <WorkspaceHeader
        project={currentProject}
        onBack={onBack}
        onTitleChange={handleTitleChange}
        onAdvance={handleAdvance}
      />

      {/* Split layout */}
      <div ref={containerRef} className="flex flex-1 overflow-hidden">
        {/* Left Panel — Content Tabs */}
        <div
          className="flex flex-col overflow-hidden"
          style={{ width: `${leftPercent}%` }}
        >
          {/* Tab bar */}
          <nav className="flex shrink-0 items-center overflow-x-auto border-b border-kiuli-gray/60 bg-white px-1">
            {tabs.map((tab) => {
              const isActive = activeTab === tab
              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`relative shrink-0 px-3.5 py-2.5 text-xs font-medium transition-colors ${
                    isActive
                      ? "text-kiuli-teal"
                      : "text-kiuli-charcoal/50 hover:text-kiuli-charcoal"
                  }`}
                >
                  {tab}
                  {isActive && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-kiuli-teal" />
                  )}
                </button>
              )
            })}
          </nav>

          {/* Tab content */}
          <div className="flex-1 overflow-y-auto">{renderTabContent()}</div>
        </div>

        {/* Draggable divider */}
        <div
          onMouseDown={handleMouseDown}
          className="relative z-10 flex w-0 shrink-0 cursor-col-resize items-center justify-center"
        >
          <div className="absolute inset-y-0 -left-[2px] w-[5px] hover:bg-kiuli-teal/10" />
          <div className="pointer-events-none absolute inset-y-0 left-0 w-px bg-kiuli-gray/60" />
        </div>

        {/* Right Panel — Conversation */}
        <div
          className="flex overflow-hidden"
          style={{ width: `${100 - leftPercent}%` }}
        >
          <ConversationPanel
            messages={currentProject.messages}
            onSendMessage={handleSendMessage}
            inputValue={inputValue}
            onInputChange={setInputValue}
          />
        </div>
      </div>
    </div>
  )
}

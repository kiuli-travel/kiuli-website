'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { WorkspaceHeader } from './WorkspaceHeader'
import { ConversationPanel } from './ConversationPanel'
import {
  BriefTab,
  ResearchTab,
  DraftTab,
  FAQTab,
  ImagesTab,
  DistributionTab,
  MetadataTab,
} from './ContentTabs'
import {
  getTabsForContentType,
  type WorkspaceProject,
} from '../workspace-types'
import {
  advanceProjectStage,
  fetchProjectData,
} from '@/app/(payload)/admin/content-engine/project/[id]/actions'

interface ProjectWorkspaceProps {
  project: WorkspaceProject
  projectId: number
}

export function ProjectWorkspace({ project, projectId }: ProjectWorkspaceProps) {
  const router = useRouter()
  const [currentProject, setCurrentProject] = useState<WorkspaceProject>(project)
  const tabs = getTabsForContentType(currentProject.contentType)
  const [activeTab, setActiveTab] = useState(tabs[0])
  const [inputValue, setInputValue] = useState('')

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
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
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
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [])

  const handleBack = useCallback(() => {
    router.push('/admin/content-engine')
  }, [router])

  const handleAdvance = useCallback(async () => {
    const result = await advanceProjectStage(projectId)
    if ('error' in result) {
      alert(result.error)
      return
    }
    const refreshed = await fetchProjectData(projectId)
    if ('project' in refreshed) {
      setCurrentProject(refreshed.project)
    }
  }, [projectId])

  const refreshProject = useCallback(async () => {
    const refreshed = await fetchProjectData(projectId)
    if ('project' in refreshed) {
      setCurrentProject(refreshed.project)
    }
  }, [projectId])

  const handleFocusSection = useCallback((sectionName: string) => {
    setInputValue(`Let's work on the ${sectionName} section`)
  }, [])

  function renderTabContent() {
    switch (activeTab) {
      case 'Brief':
        return <BriefTab project={currentProject} projectId={projectId} />
      case 'Research':
        return (
          <ResearchTab
            project={currentProject}
            projectId={projectId}
            onDataChanged={refreshProject}
          />
        )
      case 'Draft':
        return (
          <DraftTab
            project={currentProject}
            projectId={projectId}
            onFocusSection={handleFocusSection}
          />
        )
      case 'FAQ':
        return <FAQTab project={currentProject} projectId={projectId} />
      case 'Images':
        return <ImagesTab />
      case 'Distribution':
        return <DistributionTab project={currentProject} projectId={projectId} />
      case 'Metadata':
        return <MetadataTab project={currentProject} />
      case 'Current vs Proposed':
        return (
          <DraftTab
            project={currentProject}
            projectId={projectId}
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
      <WorkspaceHeader
        project={currentProject}
        projectId={projectId}
        onBack={handleBack}
        onAdvance={handleAdvance}
        onProjectUpdate={setCurrentProject}
      />

      <div ref={containerRef} className="flex flex-1 overflow-hidden">
        {/* Left Panel — Content Tabs */}
        <div
          className="flex flex-col overflow-hidden"
          style={{ width: `${leftPercent}%` }}
        >
          <nav className="flex shrink-0 items-center overflow-x-auto border-b border-kiuli-gray/60 bg-white px-1">
            {tabs.map((tab) => {
              const isActive = activeTab === tab
              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`relative shrink-0 px-3.5 py-2.5 text-xs font-medium transition-colors ${
                    isActive
                      ? 'text-kiuli-teal'
                      : 'text-kiuli-charcoal/50 hover:text-kiuli-charcoal'
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
            projectId={projectId}
            initialMessages={currentProject.messages}
            onActionApplied={refreshProject}
            inputValue={inputValue}
            onInputChange={setInputValue}
          />
        </div>
      </div>
    </div>
  )
}

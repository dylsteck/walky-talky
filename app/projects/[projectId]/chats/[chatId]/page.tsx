'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery, useAction } from 'convex/react'
import { api } from '../../../../../convex/_generated/api'
import { useSession } from '../../../../../lib/hooks/useSession'
import { useApiValidation } from '../../../../../lib/hooks/useApiValidation'
import PromptComponent from '../../../../components/prompt-component'
import ApiKeyError from '../../../../components/api-key-error'
import RateLimitDialog from '../../../../components/rate-limit-dialog'
import ErrorDialog from '../../../../components/error-dialog'

export default function ChatPage() {
  const params = useParams()
  const router = useRouter()
  const v0ProjectId = params.projectId as string
  const v0ChatId = params.chatId as string
  const sessionId = useSession()

  const [isLoading, setIsLoading] = useState(false)
  const [generatedApp, setGeneratedApp] = useState<string | null>(null)
  const [chatData, setChatData] = useState<any>(null)
  const [showRateLimitDialog, setShowRateLimitDialog] = useState(false)
  const [rateLimitInfo, setRateLimitInfo] = useState<{ resetTime?: string; remaining?: number }>({})
  const [showErrorDialog, setShowErrorDialog] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const { isValidating, showApiKeyError } = useApiValidation()
  const generate = useAction(api.v0Actions.generate)
  const getChatDetails = useAction(api.v0Actions.getChatDetails)
  const deleteChatAction = useAction(api.v0Actions.deleteChat)
  const renameChatAction = useAction(api.v0Actions.renameChat)
  const deployAction = useAction(api.v0Actions.deploy)
  const getProjectDetails = useAction(api.v0Actions.getProjectDetails)

  // Get Convex project + chats for dropdowns
  const convexProject = useQuery(api.projects.getByV0Id, { v0ProjectId })
  const convexChats = useQuery(
    api.chats.listByProject,
    convexProject ? { projectId: convexProject._id } : 'skip'
  )
  const projects = useQuery(
    api.projects.list,
    sessionId ? { sessionId } : 'skip'
  )

  // Get current chat from Convex
  const convexChat = useQuery(
    api.chats.getByV0Id,
    v0ChatId && v0ChatId !== 'new' && v0ChatId !== 'new-chat' ? { v0ChatId } : 'skip'
  )

  // Sync project on mount
  useEffect(() => {
    if (!isValidating && !showApiKeyError && sessionId && v0ProjectId) {
      getProjectDetails({ sessionId, v0ProjectId }).catch(() => {})
    }
  }, [isValidating, showApiKeyError, sessionId, v0ProjectId])

  // Load chat details from v0 API
  useEffect(() => {
    if (!isValidating && !showApiKeyError && v0ChatId && v0ChatId !== 'new' && v0ChatId !== 'new-chat') {
      loadChatData()
    }
  }, [v0ChatId, isValidating, showApiKeyError])

  // Update generated app when convex chat changes
  useEffect(() => {
    if (convexChat) {
      if (convexChat.demoUrl) setGeneratedApp(convexChat.demoUrl)
      else if (convexChat.v0Url) setGeneratedApp(convexChat.v0Url)
    }
  }, [convexChat])

  const loadChatData = async () => {
    try {
      const data = await getChatDetails({ v0ChatId })
      setChatData(data)
      if ((data as any).demo) setGeneratedApp((data as any).demo)
      else if ((data as any).url) setGeneratedApp((data as any).url)
    } catch {}
  }

  const handleSubmit = async (
    prompt: string,
    settings: { modelId: string; imageGenerations: boolean; thinking: boolean },
    attachments?: { url: string; name?: string; type?: string }[],
  ) => {
    if (!sessionId) return
    setIsLoading(true)

    try {
      const isNewChat = v0ChatId === 'new' || v0ChatId === 'new-chat'
      const data = await generate({
        sessionId,
        message: prompt,
        v0ChatId: isNewChat ? undefined : v0ChatId,
        v0ProjectId: v0ProjectId,
        modelId: settings.modelId,
        imageGenerations: settings.imageGenerations,
        thinking: settings.thinking,
        attachments: attachments?.map(a => ({ url: a.url, name: a.name, type: a.type })),
      })

      if ('error' in data && data.error === 'RATE_LIMIT_EXCEEDED') {
        setRateLimitInfo({ resetTime: data.resetTime as string, remaining: data.remaining as number })
        setShowRateLimitDialog(true)
        return
      }

      setChatData(data)

      if (isNewChat && data.id) {
        const newProjectId = data.projectId || v0ProjectId
        router.replace(`/projects/${newProjectId}/chats/${data.id}`)
        return
      }

      if (data.demo) setGeneratedApp(data.demo as string)
      else if (data.url) setGeneratedApp(data.url as string)
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to generate app.')
      setShowErrorDialog(true)
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeleteChat = async () => {
    if (!convexChat) return
    try {
      await deleteChatAction({ chatId: convexChat._id, v0ChatId })
      router.push(`/projects/${v0ProjectId}`)
    } catch {
      setErrorMessage('Failed to delete chat.')
      setShowErrorDialog(true)
    }
  }

  const handleRenameChat = async (newName: string) => {
    if (!convexChat) return
    await renameChatAction({ chatId: convexChat._id, v0ChatId, name: newName })
    setChatData((prev: any) => prev ? { ...prev, name: newName } : prev)
  }

  const handleDeploy = async () => {
    const versionId = convexChat?.latestVersionId || chatData?.latestVersion?.id
    if (!versionId) return
    try {
      const deployment = await deployAction({
        v0ProjectId,
        v0ChatId,
        versionId,
      })
      if ((deployment as any)?.webUrl) {
        window.open((deployment as any).webUrl, '_blank')
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Deployment failed.')
      setShowErrorDialog(true)
    }
  }

  if (showApiKeyError) return <ApiKeyError />

  const projectsList = (projects || []).map((p) => ({ id: p.v0ProjectId, name: p.name }))
  const chatsList = (convexChats || []).map((c) => ({
    id: c.v0ChatId,
    name: c.name,
    title: c.title,
    v0ChatId: c.v0ChatId,
    _creationTime: c._creationTime,
  }))

  // Merge convex chat data with v0 API chat data for display
  const mergedChatData = {
    ...chatData,
    name: convexChat?.name || chatData?.name,
    v0Url: convexChat?.v0Url || chatData?.url,
    latestVersionStatus: convexChat?.latestVersionStatus || chatData?.latestVersion?.status,
    latestVersionId: convexChat?.latestVersionId || chatData?.latestVersion?.id,
  }

  return (
    <div className="relative min-h-dvh bg-background">
      <div className="absolute inset-0 overflow-hidden">
        {generatedApp ? (
          <div className="w-full h-full bg-white">
            {generatedApp.startsWith('http') ? (
              <iframe src={generatedApp} className="w-full h-full border-0" sandbox="allow-scripts allow-same-origin allow-modals allow-forms allow-popups allow-top-navigation-by-user-activation allow-pointer-lock" />
            ) : (
              <iframe srcDoc={generatedApp} className="w-full h-full border-0" sandbox="allow-scripts allow-same-origin allow-modals allow-forms allow-pointer-lock" />
            )}
          </div>
        ) : null}
      </div>

      <PromptComponent
        onSubmit={handleSubmit}
        isLoading={isLoading}
        placeholder={v0ChatId !== 'new' && v0ChatId !== 'new-chat' ? 'Refine your app...' : 'Describe your app...'}
        showDropdowns={!!projects && !!convexChats}
        projects={projectsList}
        projectChats={chatsList}
        currentProjectId={v0ProjectId}
        currentChatId={v0ChatId}
        chatData={mergedChatData}
        onDeleteChat={handleDeleteChat}
        onRenameChat={handleRenameChat}
        onDeploy={handleDeploy}
      />

      <RateLimitDialog isOpen={showRateLimitDialog} onClose={() => setShowRateLimitDialog(false)} resetTime={rateLimitInfo.resetTime} remaining={rateLimitInfo.remaining} />
      <ErrorDialog isOpen={showErrorDialog} onClose={() => setShowErrorDialog(false)} message={errorMessage} />
    </div>
  )
}

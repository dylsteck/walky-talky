'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useAction } from 'convex/react'
import { api } from '../convex/_generated/api'
import { useSession } from '../lib/hooks/useSession'
import { useApiValidation } from '../lib/hooks/useApiValidation'
import PromptComponent from './components/prompt-component'
import ApiKeyError from './components/api-key-error'
import RateLimitDialog from './components/rate-limit-dialog'
import ErrorDialog from './components/error-dialog'

export default function HomePage() {
  const router = useRouter()
  const sessionId = useSession()
  const [isLoading, setIsLoading] = useState(false)
  const [showRateLimitDialog, setShowRateLimitDialog] = useState(false)
  const [rateLimitInfo, setRateLimitInfo] = useState<{ resetTime?: string; remaining?: number }>({})
  const [showErrorDialog, setShowErrorDialog] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const { isValidating, showApiKeyError } = useApiValidation()
  const generate = useAction(api.v0Actions.generate)

  const projects = useQuery(
    api.projects.list,
    sessionId ? { sessionId } : 'skip'
  )

  const handleSubmit = async (
    prompt: string,
    settings: { modelId: string; imageGenerations: boolean; thinking: boolean },
    attachments?: { url: string; name?: string; type?: string }[],
  ) => {
    if (!sessionId) return
    setIsLoading(true)

    try {
      const data = await generate({
        sessionId,
        message: prompt,
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

      if (data.id && data.projectId) {
        router.push(`/projects/${data.projectId}/chats/${data.id}`)
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to generate app.')
      setShowErrorDialog(true)
    } finally {
      setIsLoading(false)
    }
  }

  if (showApiKeyError) return <ApiKeyError />

  const projectsList = (projects || []).map((p) => ({ id: p.v0ProjectId, name: p.name }))

  return (
    <div className="relative min-h-dvh bg-background">
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-center px-4 sm:px-6" style={{ transform: 'translateY(-25%)' }}>
          <h1 className="text-4xl md:text-6xl font-bold text-foreground mb-4 text-pretty">
            Walky Talky
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto text-pretty">
            AI-powered app builder using the{' '}
            <a href="https://v0.dev/docs/api/platform" target="_blank" rel="noopener noreferrer" className="text-foreground hover:text-muted-foreground underline">
              v0 Platform API
            </a>
            . Describe your app and see it generated instantly.
          </p>
        </div>
      </div>

      <PromptComponent
        onSubmit={handleSubmit}
        isLoading={isLoading}
        placeholder="Describe your app..."
        showDropdowns={!!projects}
        projects={projectsList}
        projectChats={[]}
        currentProjectId="new"
        currentChatId="new"
      />

      <RateLimitDialog isOpen={showRateLimitDialog} onClose={() => setShowRateLimitDialog(false)} resetTime={rateLimitInfo.resetTime} remaining={rateLimitInfo.remaining} />
      <ErrorDialog isOpen={showErrorDialog} onClose={() => setShowErrorDialog(false)} message={errorMessage} />
    </div>
  )
}

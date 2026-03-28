'use client'

import { useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery, useAction } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { useSession } from '../../../lib/hooks/useSession'
import { useApiValidation } from '../../../lib/hooks/useApiValidation'
import ApiKeyError from '../../components/api-key-error'

export default function ProjectPage() {
  const params = useParams()
  const router = useRouter()
  const v0ProjectId = params.projectId as string
  const sessionId = useSession()

  const { isValidating, showApiKeyError } = useApiValidation()
  const getProjectDetails = useAction(api.v0Actions.getProjectDetails)

  // Look up the Convex project
  const convexProject = useQuery(
    api.projects.getByV0Id,
    { v0ProjectId }
  )

  // If we have the convex project, get its chats
  const chats = useQuery(
    api.chats.listByProject,
    convexProject ? { projectId: convexProject._id } : 'skip'
  )

  useEffect(() => {
    if (!isValidating && !showApiKeyError && sessionId && v0ProjectId) {
      // Sync project details from v0
      getProjectDetails({ sessionId, v0ProjectId }).catch(() => {})
    }
  }, [isValidating, showApiKeyError, sessionId, v0ProjectId])

  useEffect(() => {
    // Once we have chats, redirect to the latest one
    if (chats && chats.length > 0) {
      const latest = chats[0] // Already sorted desc by _creationTime
      router.replace(`/projects/${v0ProjectId}/chats/${latest.v0ChatId}`)
    } else if (chats && chats.length === 0) {
      router.replace(`/projects/${v0ProjectId}/chats/new-chat`)
    }
  }, [chats, v0ProjectId, router])

  if (showApiKeyError) return <ApiKeyError />

  return (
    <div className="min-h-dvh bg-background flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-foreground border-t-transparent mx-auto mb-4"></div>
      </div>
    </div>
  )
}

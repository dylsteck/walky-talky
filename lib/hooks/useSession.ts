"use client"

import { useState, useEffect } from "react"
import { useMutation } from "convex/react"
import { api } from "../../convex/_generated/api"

function generateId(): string {
  return crypto.randomUUID()
}

const SESSION_KEY = "walky-talky-session-id"

export function useSession() {
  const [sessionId, setSessionId] = useState<string | null>(null)
  const ensureSession = useMutation(api.sessions.ensureSession)

  useEffect(() => {
    let id = localStorage.getItem(SESSION_KEY)
    if (!id) {
      id = generateId()
      localStorage.setItem(SESSION_KEY, id)
    }
    setSessionId(id)
    ensureSession({ sessionId: id })
  }, [])

  return sessionId
}

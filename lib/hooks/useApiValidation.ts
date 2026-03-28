"use client"

import { useState, useEffect } from "react"
import { useAction } from "convex/react"
import { api } from "../../convex/_generated/api"

export function useApiValidation() {
  const [isValidating, setIsValidating] = useState(true)
  const [isValid, setIsValid] = useState(false)
  const [showApiKeyError, setShowApiKeyError] = useState(false)
  const [user, setUser] = useState<any>(null)
  const validateApiKey = useAction(api.v0Actions.validateApiKey)

  useEffect(() => {
    async function validate() {
      try {
        const result = await validateApiKey()
        if (result.valid) {
          setIsValid(true)
          setUser(result.user)
        } else {
          setShowApiKeyError(true)
        }
      } catch {
        setShowApiKeyError(true)
      } finally {
        setIsValidating(false)
      }
    }
    validate()
  }, [])

  return { isValidating, isValid, showApiKeyError, user }
}

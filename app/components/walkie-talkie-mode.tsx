'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { XIcon, MicIcon, ExternalLinkIcon } from 'lucide-react'
import { useSettings } from '../../lib/hooks/useSettings'

type Phase = 'idle' | 'recording' | 'previewing' | 'generating' | 'done'

interface WalkieTalkieModeProps {
  onSubmit: (
    prompt: string,
    settings: { modelId: string; imageGenerations: boolean; thinking: boolean },
  ) => Promise<void>
  isLoading: boolean
  generatedApp: string | null
  chatData: any
  onExit: () => void
}

export default function WalkieTalkieMode({
  onSubmit,
  isLoading,
  generatedApp,
  chatData,
  onExit,
}: WalkieTalkieModeProps) {
  const { settings } = useSettings()
  const [phase, setPhase] = useState<Phase>('idle')
  const [transcript, setTranscript] = useState('')
  const [interimText, setInterimText] = useState('')
  const [countdown, setCountdown] = useState(2)
  const [submittedPrompt, setSubmittedPrompt] = useState('')
  const [speechSupported, setSpeechSupported] = useState(true)

  const recognitionRef = useRef<any>(null)
  const countdownRef = useRef<NodeJS.Timeout | null>(null)
  const phaseRef = useRef<Phase>('idle')
  const isPointerDownRef = useRef(false)

  // Keep phaseRef in sync
  useEffect(() => {
    phaseRef.current = phase
  }, [phase])

  // Initialize speech recognition
  useEffect(() => {
    if (typeof window === 'undefined') return
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) {
      setSpeechSupported(false)
      return
    }

    const recognition = new SpeechRecognition()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'en-US'

    recognition.onresult = (event: any) => {
      let final = ''
      let interim = ''
      for (let i = 0; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          final += event.results[i][0].transcript
        } else {
          interim += event.results[i][0].transcript
        }
      }
      setTranscript(final)
      setInterimText(interim)
    }

    recognition.onend = () => {
      // Only transition to previewing if we were recording (pointer released)
      if (phaseRef.current === 'recording' && !isPointerDownRef.current) {
        // Will be handled by stopRecording
      }
    }

    recognition.onerror = () => {
      if (phaseRef.current === 'recording') {
        setPhase('idle')
        setTranscript('')
        setInterimText('')
      }
    }

    recognitionRef.current = recognition

    return () => {
      try { recognition.stop() } catch {}
      if (countdownRef.current) clearTimeout(countdownRef.current)
    }
  }, [])

  // When generation completes, exit walkie talkie mode
  useEffect(() => {
    if (phase === 'generating' && !isLoading) {
      onExit()
    }
  }, [isLoading, phase, onExit])

  const startRecording = useCallback(() => {
    if (!recognitionRef.current || phase !== 'idle') return
    setTranscript('')
    setInterimText('')
    setPhase('recording')
    isPointerDownRef.current = true
    try {
      recognitionRef.current.start()
    } catch {
      // Already started
    }
  }, [phase])

  const stopRecording = useCallback(() => {
    isPointerDownRef.current = false
    if (!recognitionRef.current || phaseRef.current !== 'recording') return
    try {
      recognitionRef.current.stop()
    } catch {}

    // Small delay to let final results come in
    setTimeout(() => {
      setTranscript((currentTranscript) => {
        setInterimText((currentInterim) => {
          const fullText = (currentTranscript + currentInterim).trim()
          if (!fullText) {
            setPhase('idle')
          } else {
            setTranscript(fullText)
            setInterimText('')
            setPhase('previewing')
            setCountdown(2)
          }
          return ''
        })
        return currentTranscript
      })
    }, 300)
  }, [])

  // Countdown timer for preview phase
  useEffect(() => {
    if (phase !== 'previewing') return
    setCountdown(2)

    const timer1 = setTimeout(() => setCountdown(1), 1000)
    const timer2 = setTimeout(() => {
      // Auto-submit
      const text = transcript.trim()
      if (text) {
        setSubmittedPrompt(text)
        setPhase('generating')
        onSubmit(text, {
          modelId: settings.model,
          imageGenerations: settings.imageGenerations,
          thinking: settings.thinking,
        })
      } else {
        setPhase('idle')
      }
    }, 2000)

    countdownRef.current = timer2

    return () => {
      clearTimeout(timer1)
      clearTimeout(timer2)
    }
  }, [phase, transcript, onSubmit, settings])

  const cancelPreview = useCallback(() => {
    if (countdownRef.current) clearTimeout(countdownRef.current)
    setPhase('idle')
    setTranscript('')
    setInterimText('')
  }, [])

  const keepTalking = useCallback(() => {
    setPhase('idle')
    setTranscript('')
    setInterimText('')
    setSubmittedPrompt('')
  }, [])

  // Spacebar push-to-talk
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat && phaseRef.current === 'idle') {
        e.preventDefault()
        startRecording()
      }
      if (e.key === 'Escape') {
        if (phaseRef.current === 'previewing') {
          cancelPreview()
        } else if (phaseRef.current === 'idle' || phaseRef.current === 'done') {
          onExit()
        }
      }
    }
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space' && phaseRef.current === 'recording') {
        e.preventDefault()
        stopRecording()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [startRecording, stopRecording, cancelPreview, onExit])

  if (!speechSupported) {
    return (
      <div className="fixed inset-0 z-50 bg-zinc-950 flex items-center justify-center">
        <div className="text-center text-white">
          <p className="text-lg mb-4">Speech recognition is not supported in this browser.</p>
          <button
            onClick={onExit}
            className="px-6 py-2 bg-white text-zinc-950 rounded-full font-medium hover:bg-zinc-200 transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 bg-zinc-950 flex flex-col select-none">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-zinc-400 text-sm font-medium tracking-wide uppercase">
            Walkie Talkie
          </span>
        </div>
        <button
          onClick={onExit}
          className="text-zinc-500 hover:text-white transition-colors p-2 rounded-lg hover:bg-zinc-800"
        >
          <XIcon className="w-5 h-5" />
        </button>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col items-center justify-center gap-8 px-6">
        {/* Status text area */}
        <div className="min-h-[120px] flex items-center justify-center text-center max-w-lg">
          {phase === 'idle' && (
            <p className="text-zinc-600 text-lg">
              Hold to talk
              <span className="block text-sm mt-1 text-zinc-700">or press spacebar</span>
            </p>
          )}

          {phase === 'recording' && (
            <div className="space-y-2">
              {(transcript || interimText) && (
                <p className="text-white text-xl font-medium leading-relaxed">
                  {transcript}
                  {interimText && (
                    <span className="text-zinc-500">{interimText}</span>
                  )}
                </p>
              )}
              {!transcript && !interimText && (
                <p className="text-zinc-500 text-lg animate-pulse">Listening...</p>
              )}
            </div>
          )}

          {phase === 'previewing' && (
            <div className="space-y-4">
              <p className="text-white text-xl font-medium leading-relaxed">{transcript}</p>
              <div className="flex items-center justify-center gap-3">
                <span className="text-zinc-500 text-sm">
                  Sending in {countdown}...
                </span>
                <button
                  onClick={cancelPreview}
                  className="text-red-400 text-sm hover:text-red-300 transition-colors underline underline-offset-2"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {phase === 'generating' && (
            <div className="space-y-4">
              <div className="flex items-center justify-center gap-3">
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
                <span className="text-white text-lg">Generating...</span>
              </div>
              <p className="text-zinc-500 text-sm">{submittedPrompt}</p>
            </div>
          )}

          {phase === 'done' && (
            <div className="space-y-6">
              <div className="space-y-2">
                <p className="text-emerald-400 text-lg font-medium">App ready</p>
                <p className="text-zinc-500 text-sm">{submittedPrompt}</p>
              </div>
              {generatedApp && (
                <a
                  href={generatedApp}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-white text-zinc-950 rounded-full font-medium hover:bg-zinc-200 transition-colors text-sm"
                >
                  <ExternalLinkIcon className="w-4 h-4" />
                  View App
                </a>
              )}
              <div>
                <button
                  onClick={keepTalking}
                  className="text-zinc-400 text-sm hover:text-white transition-colors underline underline-offset-2"
                >
                  Keep Talking
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Push-to-talk button */}
        <div className="relative">
          {/* Pulse rings when recording */}
          {phase === 'recording' && (
            <>
              <div className="absolute inset-0 rounded-full bg-red-500/20 animate-ping" style={{ animationDuration: '1.5s' }} />
              <div className="absolute -inset-4 rounded-full bg-red-500/10 animate-pulse" />
            </>
          )}

          <button
            onPointerDown={(e) => {
              e.preventDefault()
              if (phase === 'idle') startRecording()
            }}
            onPointerUp={(e) => {
              e.preventDefault()
              stopRecording()
            }}
            onPointerLeave={() => {
              if (isPointerDownRef.current) stopRecording()
            }}
            onContextMenu={(e) => e.preventDefault()}
            disabled={phase !== 'idle' && phase !== 'recording'}
            className={`relative w-28 h-28 sm:w-32 sm:h-32 rounded-full flex items-center justify-center transition-all duration-200 touch-none ${
              phase === 'recording'
                ? 'bg-red-500 scale-110 shadow-[0_0_60px_rgba(239,68,68,0.4)]'
                : phase === 'idle'
                  ? 'bg-zinc-800 hover:bg-zinc-700 border-2 border-zinc-600 hover:border-zinc-500 cursor-pointer active:scale-95'
                  : 'bg-zinc-800/50 border-2 border-zinc-700/50 cursor-not-allowed'
            }`}
          >
            <MicIcon
              className={`transition-all duration-200 ${
                phase === 'recording'
                  ? 'w-10 h-10 sm:w-12 sm:h-12 text-white'
                  : phase === 'idle'
                    ? 'w-8 h-8 sm:w-10 sm:h-10 text-zinc-400'
                    : 'w-8 h-8 sm:w-10 sm:h-10 text-zinc-600'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Footer context */}
      <div className="px-6 py-4 text-center">
        {chatData?.name && (
          <p className="text-zinc-700 text-xs">
            {chatData.name}
          </p>
        )}
      </div>
    </div>
  )
}

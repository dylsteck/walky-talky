'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  MoreVerticalIcon,
  TrashIcon,
  XIcon,
  PaperclipIcon,
  MicIcon,
} from 'lucide-react'
import { V0Logo } from '../../components/v0-logo'
import SettingsDialog from './settings-dialog'
import RenameChatDialog from './rename-chat-dialog'
import { useSettings } from '../../lib/hooks/useSettings'
import {
  ProjectDropdown,
  ChatDropdown,
} from '../projects/[projectId]/chats/[chatId]/components'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

interface Attachment {
  url: string
  name?: string
  type?: string
}

interface ImagePreviewProps {
  src: string
  alt: string
  isVisible: boolean
  position: { x: number; y: number }
}

function ImagePreview({ src, alt, isVisible, position }: ImagePreviewProps) {
  if (!isVisible) return null

  return (
    <div
      className="fixed z-50 pointer-events-none"
      style={{
        left: position.x,
        top: position.y,
        transform: 'translate(-50%, -100%)',
      }}
    >
      <div className="bg-card rounded-lg shadow-2xl border border-border p-2 max-w-xs">
        <img
          src={src}
          alt={alt}
          className="w-full h-48 object-cover object-center rounded"
          onError={(e) => {
            ;(e.target as HTMLElement).closest('[data-preview]')?.remove()
          }}
        />
        <p className="text-xs text-muted-foreground mt-1 truncate">{alt}</p>
      </div>
    </div>
  )
}

interface PromptComponentProps {
  initialPrompt?: string
  initialExpanded?: boolean
  projects?: any[]
  projectChats?: any[]
  currentProjectId?: string
  currentChatId?: string
  chatData?: any
  onSubmit: (
    prompt: string,
    settings: { modelId: string; imageGenerations: boolean; thinking: boolean },
    attachments?: Attachment[],
  ) => Promise<void>
  isLoading: boolean
  error?: string | null
  placeholder?: string
  showDropdowns?: boolean
  onProjectChange?: (projectId: string) => void
  onChatChange?: (chatId: string) => void
  onDeleteChat?: () => Promise<void>
  onRenameChat?: (newName: string) => Promise<void>
  onDeploy?: () => Promise<void>
}

export default function PromptComponent({
  initialPrompt = '',
  initialExpanded = true,
  projects = [],
  projectChats = [],
  currentProjectId,
  currentChatId,
  chatData,
  onSubmit,
  isLoading,
  error,
  placeholder = 'Describe your app...',
  showDropdowns = false,
  onProjectChange,
  onChatChange,
  onDeleteChat,
  onRenameChat,
  onDeploy,
}: PromptComponentProps) {
  const router = useRouter()
  const { settings } = useSettings()
  const [prompt, setPrompt] = useState(initialPrompt)
  const [isPromptExpanded, setIsPromptExpanded] = useState(initialExpanded)
  const [shouldAnimate, setShouldAnimate] = useState(false)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [isListening, setIsListening] = useState(false)
  const [speechSupported, setSpeechSupported] = useState(false)
  const [previewState, setPreviewState] = useState<{
    isVisible: boolean
    src: string
    alt: string
    position: { x: number; y: number }
  }>({
    isVisible: false,
    src: '',
    alt: '',
    position: { x: 0, y: 0 },
  })
  const [isDragging, setIsDragging] = useState(false)
  const [isOverPrompt, setIsOverPrompt] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const recognitionRef = useRef<any>(null)

  const PROMPT_STORAGE_KEY = 'v0-draft-prompt'
  const ATTACHMENTS_STORAGE_KEY = 'v0-draft-attachments'

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const savedPrompt = sessionStorage.getItem(PROMPT_STORAGE_KEY)
        const savedAttachments = sessionStorage.getItem(ATTACHMENTS_STORAGE_KEY)
        if (savedPrompt && !initialPrompt) setPrompt(savedPrompt)
        if (savedAttachments) setAttachments(JSON.parse(savedAttachments))
      } catch {}
    }
  }, [initialPrompt])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        if (prompt) sessionStorage.setItem(PROMPT_STORAGE_KEY, prompt)
        else sessionStorage.removeItem(PROMPT_STORAGE_KEY)
      } catch {}
    }
  }, [prompt])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.setItem(ATTACHMENTS_STORAGE_KEY, JSON.stringify(attachments))
      } catch {}
    }
  }, [attachments])

  const clearDraft = () => {
    try {
      sessionStorage.removeItem(PROMPT_STORAGE_KEY)
      sessionStorage.removeItem(ATTACHMENTS_STORAGE_KEY)
    } catch {}
  }

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
      setSpeechSupported(!!SpeechRecognition)
      if (SpeechRecognition) {
        recognitionRef.current = new SpeechRecognition()
        recognitionRef.current.continuous = true
        recognitionRef.current.interimResults = true
        recognitionRef.current.lang = 'en-US'
        recognitionRef.current.onresult = (event: any) => {
          let finalTranscript = ''
          for (let i = event.resultIndex; i < event.results.length; i++) {
            if (event.results[i].isFinal) finalTranscript += event.results[i][0].transcript
          }
          if (finalTranscript) setPrompt((prev) => prev + finalTranscript)
        }
        recognitionRef.current.onend = () => setIsListening(false)
        recognitionRef.current.onerror = () => setIsListening(false)
      }
    }
    return () => {
      if (recognitionRef.current && isListening) recognitionRef.current.stop()
    }
  }, [])

  const toggleListening = () => {
    if (!recognitionRef.current) return
    if (isListening) {
      recognitionRef.current.stop()
      setIsListening(false)
    } else {
      recognitionRef.current.start()
      setIsListening(true)
    }
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isDialogOpen) return
      if (e.key === 'Escape') {
        if (isDragging) { setIsDragging(false); setIsOverPrompt(false) }
        if (isPromptExpanded) setIsPromptExpanded(false)
        return
      }
      if (isPromptExpanded || isLoading) return
      if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return
      if (e.key === 'Tab' || e.key === 'Enter') return
      if (e.key.startsWith('Arrow') || e.key.startsWith('F')) return
      if (e.key.length === 1) {
        setShouldAnimate(true)
        setIsPromptExpanded(true)
        setPrompt(e.key)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isPromptExpanded, isLoading, router, currentProjectId, isDialogOpen, isDragging])

  useEffect(() => {
    if (!isDragging) return
    const handleGlobalDragEnd = () => { setIsDragging(false); setIsOverPrompt(false) }
    const handleMouseUp = () => setTimeout(handleGlobalDragEnd, 50)
    document.addEventListener('dragend', handleGlobalDragEnd)
    document.addEventListener('mouseup', handleMouseUp)
    return () => {
      document.removeEventListener('dragend', handleGlobalDragEnd)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!prompt.trim()) return
    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop()
      setIsListening(false)
    }
    setIsPromptExpanded(false)
    setShouldAnimate(false)
    try {
      await onSubmit(prompt.trim(), {
        modelId: settings.model,
        imageGenerations: settings.imageGenerations,
        thinking: settings.thinking,
      }, attachments)
      setPrompt('')
      setAttachments([])
      clearDraft()
    } catch {}
  }

  const handleRenameChat = async (newName: string) => {
    if (!onRenameChat) return
    await onRenameChat(newName)
  }

  const handleFileSelect = async (files: FileList) => {
    const newAttachments: Attachment[] = []
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const dataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader()
        reader.onload = (e) => resolve(e.target?.result as string)
        reader.readAsDataURL(file)
      })
      newAttachments.push({ url: dataUrl, name: file.name, type: file.type })
    }
    setAttachments([...attachments, ...newAttachments])
  }

  const removeAttachment = (index: number) => {
    const a = attachments[index]
    if (previewState.isVisible && previewState.src === a?.url) {
      setPreviewState((prev) => ({ ...prev, isVisible: false }))
    }
    setAttachments(attachments.filter((_, i) => i !== index))
  }

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation()
    if (e.dataTransfer.types.includes('Files')) {
      setIsDragging(true)
      const target = e.currentTarget as HTMLElement
      if (target.dataset.dragContainer === 'prompt') setIsOverPrompt(true)
    }
  }
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation()
    const target = e.currentTarget as HTMLElement
    if (target.dataset.dragContainer === 'prompt') {
      const rect = target.getBoundingClientRect()
      if (e.clientX < rect.left || e.clientX >= rect.right || e.clientY < rect.top || e.clientY >= rect.bottom) {
        setIsOverPrompt(false)
      }
    }
  }
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation() }
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation()
    setIsDragging(false); setIsOverPrompt(false)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await handleFileSelect(e.dataTransfer.files)
      e.dataTransfer.clearData()
    }
  }
  const handleDragEnd = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation()
    setIsDragging(false); setIsOverPrompt(false)
  }

  return (
    <>
      {!isPromptExpanded && (
        <div className="fixed bottom-6 right-6 z-50 animate-fade-in">
          <button
            onClick={() => { setShouldAnimate(true); setIsPromptExpanded(true) }}
            className="text-foreground bg-background border border-border w-14 h-14 rounded-full shadow-lg transition-all duration-200 cursor-pointer hover:opacity-80 flex items-center justify-center"
          >
            {isLoading ? (
              <div className="animate-spin rounded-full h-6 w-6 border-2 border-foreground border-t-transparent"></div>
            ) : (
              <V0Logo size={24} className="text-foreground" />
            )}
          </button>
        </div>
      )}

      {isDragging && (
        <div
          className="fixed inset-0 z-20 pointer-events-auto"
          onDragEnter={handleDragEnter}
          onDragLeave={(e) => {
            if (e.clientX === 0 && e.clientY === 0) { setIsDragging(false); setIsOverPrompt(false) }
          }}
          onDragOver={handleDragOver}
          onDrop={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); setIsOverPrompt(false) }}
        />
      )}

      {isPromptExpanded && (
        <div className={`fixed inset-x-0 bottom-0 z-30 pointer-events-none ${shouldAnimate ? 'animate-slide-up' : ''}`}>
          <div className="mx-auto max-w-4xl px-3 sm:px-6 pb-4 sm:pb-8 pointer-events-auto">
            <div
              className={`relative bg-card/80 backdrop-blur-lg rounded-2xl shadow-2xl overflow-hidden border transition-all duration-200 ${isDragging ? 'border-primary border-2 bg-primary/5' : 'border-border/50'}`}
              data-drag-container="prompt"
              onDragEnter={handleDragEnter}
              onDragLeave={handleDragLeave}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onDragEnd={handleDragEnd}
            >
              {isDragging && isOverPrompt && (
                <div className="absolute inset-0 bg-primary/5 z-10 flex items-center justify-center rounded-2xl">
                  <div className="flex items-center gap-2 bg-primary/10 backdrop-blur-sm px-3 py-2 rounded-lg border border-primary/20">
                    <PaperclipIcon className="w-4 h-4 text-primary" />
                    <span className="text-primary font-medium text-sm">Drop files</span>
                  </div>
                </div>
              )}

              <div className="p-3 sm:p-6">
                <form onSubmit={handleSubmit}>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept="image/*,.pdf,.doc,.docx,.txt"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files && e.target.files.length > 0) {
                        handleFileSelect(e.target.files)
                        e.target.value = ''
                      }
                    }}
                  />

                  {attachments.length > 0 && (
                    <div className="mb-3 flex flex-wrap gap-2">
                      {attachments.map((attachment, index) => {
                        const isImage = attachment.type?.startsWith('image/')
                        return (
                          <div
                            key={index}
                            className="flex items-center gap-2 px-3 py-1.5 bg-muted rounded-lg text-sm text-muted-foreground relative"
                            onMouseEnter={(e) => {
                              if (isImage) {
                                const rect = e.currentTarget.getBoundingClientRect()
                                setPreviewState({
                                  isVisible: true, src: attachment.url,
                                  alt: attachment.name || 'Image attachment',
                                  position: { x: rect.left + rect.width / 2, y: rect.top - 10 },
                                })
                              }
                            }}
                            onMouseLeave={() => { if (isImage) setPreviewState((prev) => ({ ...prev, isVisible: false })) }}
                          >
                            <PaperclipIcon className="w-3 h-3" />
                            <span className="truncate max-w-32">{attachment.name || 'Attachment'}</span>
                            <button type="button" onClick={() => removeAttachment(index)} className="text-muted-foreground hover:text-foreground transition-colors">
                              <XIcon className="w-3 h-3" />
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  )}

                  <div className="relative">
                    <textarea
                      ref={(textarea) => {
                        if (textarea && isPromptExpanded && prompt.length === 1) {
                          setTimeout(() => { textarea.focus(); textarea.setSelectionRange(textarea.value.length, textarea.value.length) }, 0)
                        } else if (textarea && isPromptExpanded && prompt.length === 0) {
                          setTimeout(() => textarea.focus(), 0)
                        }
                      }}
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      placeholder={placeholder}
                      rows={1}
                      className={`w-full pl-2 sm:pl-2.5 py-2 sm:py-4 text-base sm:text-lg bg-transparent border-0 focus:ring-0 focus:outline-none text-foreground placeholder-muted-foreground font-medium resize-none overflow-hidden ${speechSupported ? 'pr-24 sm:pr-32' : 'pr-20 sm:pr-24'}`}
                      disabled={isLoading}
                      style={{ minHeight: '44px', height: 'auto' }}
                      onInput={(e) => {
                        const target = e.target as HTMLTextAreaElement
                        target.style.height = 'auto'
                        target.style.height = Math.min(target.scrollHeight, 200) + 'px'
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(e as any) }
                      }}
                    />

                    {speechSupported && (
                      <button
                        type="button"
                        onClick={toggleListening}
                        disabled={isLoading}
                        className={`absolute top-1/2 -translate-y-1/2 flex items-center justify-center h-8 w-8 sm:h-10 sm:w-10 rounded-lg transition-all duration-200 cursor-pointer disabled:cursor-not-allowed ${isListening ? 'text-red-600 bg-red-50 hover:text-red-700 hover:bg-red-100' : 'text-muted-foreground hover:text-foreground disabled:text-muted-foreground/50'}`}
                        style={{ right: '80px' }}
                      >
                        <MicIcon className="w-4 h-4" />
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isLoading}
                      className="absolute top-1/2 -translate-y-1/2 flex items-center justify-center h-8 w-8 sm:h-10 sm:w-10 rounded-lg text-muted-foreground hover:text-foreground disabled:text-muted-foreground/50 transition-all duration-200 cursor-pointer disabled:cursor-not-allowed"
                      style={{ right: speechSupported ? '48px' : '48px' }}
                    >
                      <PaperclipIcon className="w-4 h-4" />
                    </button>

                    <button
                      type="submit"
                      disabled={isLoading || !prompt.trim()}
                      className="absolute right-0 top-1/2 -translate-y-1/2 flex items-center justify-center h-8 w-8 sm:h-10 sm:w-10 rounded-full bg-primary text-primary-foreground hover:bg-primary/80 disabled:bg-muted disabled:text-muted-foreground transition-all duration-200 cursor-pointer disabled:cursor-not-allowed"
                    >
                      {isLoading ? (
                        <div className="animate-spin rounded-full h-4 w-4 sm:h-5 sm:w-5 border-2 border-primary-foreground border-t-transparent"></div>
                      ) : (
                        <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                        </svg>
                      )}
                    </button>
                  </div>

                  <div className="mt-2 sm:mt-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3">
                    <div className="flex items-center justify-between sm:flex-1">
                      <div className="flex items-center gap-0 flex-1 max-w-[300px] sm:max-w-[400px]">
                        {showDropdowns && currentProjectId ? (
                          <>
                            <ProjectDropdown
                              currentProjectId={currentProjectId}
                              currentChatId={currentChatId || 'new'}
                              projects={projects}
                              onProjectChange={onProjectChange}
                            />
                            <ChatDropdown
                              projectId={currentProjectId}
                              currentChatId={currentChatId || 'new'}
                              chats={projectChats}
                              onChatChange={onChatChange}
                            />
                          </>
                        ) : currentProjectId && (projects.length === 0 || projectChats.length === 0) ? (
                          <div className="flex items-center gap-2">
                            <Skeleton className="h-8 w-32" />
                            <Skeleton className="h-8 w-24" />
                          </div>
                        ) : currentProjectId ? (
                          <div className="flex gap-0">
                            <div className="h-8 w-24 bg-transparent"></div>
                            <div className="h-8 w-20 bg-transparent"></div>
                          </div>
                        ) : null}
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0 ml-2 sm:ml-0">
                                <MoreVerticalIcon className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" side="top">
                              <SettingsDialog />

                              <DropdownMenuItem asChild>
                                <a href={chatData?.v0Url || chatData?.url || 'https://v0.dev'} target="_blank" rel="noopener noreferrer" className="flex items-center">
                                  <svg className="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                  </svg>
                                  View on v0.dev
                                </a>
                              </DropdownMenuItem>

                              {showDropdowns && currentProjectId && currentChatId && currentChatId !== 'new' && chatData && chatData.latestVersionStatus === 'completed' && onDeploy && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem onClick={onDeploy}>
                                    <svg className="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                    </svg>
                                    Deploy
                                  </DropdownMenuItem>
                                </>
                              )}

                              {showDropdowns && currentProjectId && currentChatId && currentChatId !== 'new' && onRenameChat && chatData && (
                                <>
                                  <DropdownMenuSeparator />
                                  <RenameChatDialog
                                    chatId={currentChatId}
                                    currentName={chatData.name || 'Untitled Chat'}
                                    onRename={handleRenameChat}
                                    onOpenChange={setIsDialogOpen}
                                  />
                                </>
                              )}

                              {showDropdowns && currentProjectId && currentChatId && currentChatId !== 'new' && onDeleteChat && chatData && (
                                <>
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                                        <TrashIcon className="mr-2 h-4 w-4" />
                                        Delete Chat
                                      </DropdownMenuItem>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                      <AlertDialogHeader>
                                        <AlertDialogTitle>Delete Chat</AlertDialogTitle>
                                        <AlertDialogDescription>Are you sure you want to delete this chat? This action cannot be undone.</AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction onClick={onDeleteChat} className="bg-destructive text-white hover:bg-destructive/90">Delete</AlertDialogAction>
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>

                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 sm:hidden" onClick={() => setIsPromptExpanded(false)}>
                            <XIcon className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </form>

                {error && (
                  <div className="mt-4 px-4 py-3 text-red-700 text-sm bg-red-50 border border-red-200 rounded-xl">
                    {error}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <ImagePreview
        src={previewState.src}
        alt={previewState.alt}
        isVisible={previewState.isVisible}
        position={previewState.position}
      />
    </>
  )
}

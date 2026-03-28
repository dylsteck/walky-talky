'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAction } from 'convex/react'
import { api } from '../../../../../convex/_generated/api'
import { ChevronDownIcon, CheckIcon } from 'lucide-react'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer'
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from '@/components/ui/command'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface Project {
  id: string
  name?: string
}

interface Chat {
  id: string
  name?: string
  title?: string
  v0ChatId?: string
  _creationTime?: number
}

interface ProjectDropdownProps {
  currentProjectId: string
  currentChatId: string
  projects: Project[]
  onProjectChange?: (projectId: string) => void
}

interface ChatDropdownProps {
  projectId: string
  currentChatId: string
  chats: Chat[]
  onChatChange?: (chatId: string) => void
}

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])
  return isMobile
}

export function ProjectDropdown({
  currentProjectId,
  currentChatId,
  projects,
  onProjectChange,
}: ProjectDropdownProps) {
  const router = useRouter()
  const [currentProject, setCurrentProject] = useState<Project | null>(null)
  const [open, setOpen] = useState(false)
  const prevProjectsLengthRef = useRef(projects.length)
  const isMobile = useIsMobile()

  useEffect(() => {
    const project = projects.find((p) => p.id === currentProjectId)
    setCurrentProject(project || null)
    if (prevProjectsLengthRef.current !== projects.length && open) setOpen(true)
    prevProjectsLengthRef.current = projects.length
  }, [projects, currentProjectId, open])

  const handleProjectSelect = (projectId: string) => {
    setOpen(false)
    if (projectId === 'new') {
      router.push('/')
    } else if (projectId !== currentProjectId) {
      router.push(`/projects/${projectId}`)
    }
  }

  const triggerButton = (
    <Button variant="ghost" size="sm" className="gap-1 justify-start max-w-[150px] sm:max-w-[200px]" role="combobox" aria-expanded={open}>
      <span className="text-sm text-gray-900 dark:text-white truncate">
        {currentProjectId === 'new' ? 'New Project' : currentProject?.name || 'Project'}
      </span>
      <ChevronDownIcon className="h-4 w-4 text-gray-600 dark:text-white flex-shrink-0" />
    </Button>
  )

  const commandContent = (
    <Command>
      <CommandInput placeholder="Search projects..." />
      <CommandList className="max-h-[200px]">
        <CommandEmpty>No projects found.</CommandEmpty>
        <CommandGroup>
          <CommandItem value="new-project" onSelect={() => handleProjectSelect('new')} className="justify-between">
            <span>+ New Project</span>
          </CommandItem>
          {projects.length > 0 && <CommandSeparator />}
          {projects.map((project) => (
            <CommandItem
              key={project.id}
              value={project.name || 'Untitled Project'}
              onSelect={() => handleProjectSelect(project.id)}
              className={cn('justify-between', project.id === currentProjectId && 'bg-accent')}
            >
              <span>{project.name || 'Untitled Project'}</span>
              {project.id === currentProjectId && <CheckIcon className="h-4 w-4" />}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </Command>
  )

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerTrigger asChild>{triggerButton}</DrawerTrigger>
        <DrawerContent>
          <DrawerHeader><DrawerTitle>Select Project</DrawerTitle></DrawerHeader>
          <div className="px-4 pb-4">{commandContent}</div>
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{triggerButton}</PopoverTrigger>
      <PopoverContent className="w-[200px] p-0" align="start">{commandContent}</PopoverContent>
    </Popover>
  )
}

export function ChatDropdown({
  projectId,
  currentChatId,
  chats,
  onChatChange,
}: ChatDropdownProps) {
  const router = useRouter()
  const forkChat = useAction(api.v0Actions.forkChat)
  const [open, setOpen] = useState(false)
  const prevChatsLengthRef = useRef(chats.length)
  const isMobile = useIsMobile()

  const currentChat = chats.find((c) => c.id === currentChatId)

  useEffect(() => {
    if (prevChatsLengthRef.current !== chats.length && open) setOpen(true)
    prevChatsLengthRef.current = chats.length
  }, [chats, open])

  const handleChatSelect = async (chatId: string) => {
    setOpen(false)
    if (chatId === 'new-from-scratch') {
      if (onChatChange) onChatChange('new')
      return
    } else if (chatId === 'new-from-latest') {
      await handleForkLatestChat()
      return
    } else if (chatId !== currentChatId) {
      router.push(`/projects/${projectId}/chats/${chatId}`)
    }
    if (onChatChange) onChatChange(chatId)
  }

  const handleForkLatestChat = async () => {
    try {
      const sorted = [...chats].sort((a: any, b: any) => (b._creationTime || 0) - (a._creationTime || 0))
      if (sorted.length === 0) return
      const latestChat = sorted[0]
      if (!latestChat.v0ChatId) return

      const sessionId = localStorage.getItem('walky-talky-session-id')
      if (!sessionId) return

      const forkedChat = await forkChat({
        sessionId,
        v0ChatId: latestChat.v0ChatId,
        v0ProjectId: projectId,
      })

      if (forkedChat && (forkedChat as any).id) {
        router.push(`/projects/${projectId}/chats/${(forkedChat as any).id}`)
      }
    } catch {}
  }

  const getChatTitle = (chat: Chat) => chat.title || chat.name || 'Untitled Chat'

  const triggerButton = (
    <Button variant="ghost" size="sm" className="gap-1 justify-start max-w-[120px] sm:max-w-[160px]" role="combobox" aria-expanded={open}>
      <span className="text-sm text-gray-900 dark:text-white truncate">
        {currentChat ? getChatTitle(currentChat) : 'New Chat'}
      </span>
      <ChevronDownIcon className="h-4 w-4 text-gray-600 dark:text-white flex-shrink-0" />
    </Button>
  )

  const commandContent = (
    <Command>
      <CommandInput placeholder="Search chats..." />
      <CommandList className="max-h-[200px]">
        <CommandEmpty>No chats found.</CommandEmpty>
        <CommandGroup>
          <CommandItem value="new-from-scratch" onSelect={() => handleChatSelect('new-from-scratch')} className={cn('justify-between', currentChatId === 'new' && 'bg-accent')}>
            <span>+ New from Scratch</span>
            {currentChatId === 'new' && <CheckIcon className="h-4 w-4" />}
          </CommandItem>
          {chats.length > 0 && (
            <CommandItem value="new-from-latest" onSelect={() => handleChatSelect('new-from-latest')} className="justify-between">
              <span>+ New from Latest</span>
            </CommandItem>
          )}
          {chats.length > 0 && <CommandSeparator />}
          {chats.map((chat) => (
            <CommandItem
              key={chat.id}
              value={getChatTitle(chat)}
              onSelect={() => handleChatSelect(chat.id)}
              className={cn('justify-between', chat.id === currentChatId && 'bg-accent')}
            >
              <span>{getChatTitle(chat)}</span>
              {chat.id === currentChatId && <CheckIcon className="h-4 w-4" />}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </Command>
  )

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerTrigger asChild>{triggerButton}</DrawerTrigger>
        <DrawerContent>
          <DrawerHeader><DrawerTitle>Select Chat</DrawerTitle></DrawerHeader>
          <div className="px-4 pb-4">{commandContent}</div>
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{triggerButton}</PopoverTrigger>
      <PopoverContent className="w-[200px] p-0" align="start">{commandContent}</PopoverContent>
    </Popover>
  )
}

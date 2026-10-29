'use client'
import React, { createContext, useContext, useEffect, useMemo, useReducer, useRef } from 'react'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { chaveDoUsuario } from '@components/Hooks/chaveDoUsuario'

/**
 * A small, generic "background tasks" store. It's not upload-specific — any
 * feature can register a long-running task (upload, export, generation, …) and
 * it shows up in the global notification panel. State is persisted to
 * localStorage so the panel survives a page reload.
 *
 * Note: an in-flight browser transfer (XHR) cannot survive a hard reload — the
 * request dies with the page. So on hydrate we mark any task still in
 * `uploading` as `interrupted` (the notification persists; the transfer doesn't).
 */
export type BgTaskStatus = 'uploading' | 'processing' | 'done' | 'error' | 'interrupted'

export interface BgTask {
  id: string
  /** Category, so consumers can style/route (e.g. 'video-upload'). */
  kind: string
  title: string
  subtitle?: string
  /** 0–100; ignored when indeterminate. */
  progress: number
  indeterminate?: boolean
  status: BgTaskStatus
  error?: string
  /** Optional link opened when the row is clicked (e.g. the created activity). */
  href?: string
  createdAt: number
}

type NewTask = Omit<BgTask, 'createdAt' | 'progress' | 'status' | 'id'> &
  Partial<Pick<BgTask, 'id' | 'progress' | 'status' | 'indeterminate'>>

const STORAGE_KEY = 'lh_bg_tasks'

type Action =
  | { type: 'hydrate'; tasks: BgTask[] }
  | { type: 'add'; task: BgTask }
  | { type: 'update'; id: string; patch: Partial<BgTask> }
  | { type: 'remove'; id: string }
  | { type: 'clearFinished' }

function reducer(state: BgTask[], action: Action): BgTask[] {
  switch (action.type) {
    case 'hydrate':
      return action.tasks
    case 'add':
      return [action.task, ...state.filter((t) => t.id !== action.task.id)]
    case 'update':
      return state.map((t) => (t.id === action.id ? { ...t, ...action.patch } : t))
    case 'remove':
      return state.filter((t) => t.id !== action.id)
    case 'clearFinished':
      return state.filter((t) => t.status === 'uploading' || t.status === 'processing')
    default:
      return state
  }
}

function loadPersisted(chave: string | null): BgTask[] {
  try {
    if (typeof window === 'undefined' || !chave) return []
    // 572: a gaveta antiga, sem dono, sai (não dá para saber de quem era).
    localStorage.removeItem(STORAGE_KEY)
    const raw = localStorage.getItem(chave)
    if (!raw) return []
    const tasks = JSON.parse(raw) as BgTask[]
    if (!Array.isArray(tasks)) return []
    return tasks.map((t) =>
      t.status === 'uploading'
        ? { ...t, status: 'interrupted' as const, error: 'Interrupted by a page reload' }
        : t
    )
  } catch {
    return []
  }
}

interface BackgroundTasksApi {
  tasks: BgTask[]
  addTask: (_task: NewTask) => string
  updateTask: (_id: string, _patch: Partial<BgTask>) => void
  removeTask: (_id: string) => void
  clearFinished: () => void
}

const BackgroundTasksContext = createContext<BackgroundTasksApi | null>(null)

let _seq = 0
function makeId(): string {
  _seq += 1
  return `bg_${Date.now().toString(36)}_${_seq}`
}

export function BackgroundTasksProvider({ children }: { children: React.ReactNode }) {
  const session = useLHSession() as any
  const chave = chaveDoUsuario(STORAGE_KEY, session?.data?.user?.id)
  const [tasks, dispatch] = useReducer(reducer, [])
  // 572: a gaveta de quem é a lista que está na tela agora.
  const chaveCarregada = useRef<string | null>(null)

  // Hydrate on mount and whenever the signed-in account changes (client only).
  useEffect(() => {
    chaveCarregada.current = chave
    dispatch({ type: 'hydrate', tasks: loadPersisted(chave) })
  }, [chave])

  // Persist on every change, only into the drawer of the account the list belongs to.
  useEffect(() => {
    const destino = chaveCarregada.current
    if (!destino) return
    try {
      localStorage.setItem(destino, JSON.stringify(tasks))
    } catch {
      /* quota / private mode — ignore */
    }
  }, [tasks])

  const api = useMemo<BackgroundTasksApi>(
    () => ({
      tasks,
      addTask: (task) => {
        const id = task.id || makeId()
        dispatch({
          type: 'add',
          task: {
            progress: 0,
            status: 'uploading',
            createdAt: Date.now(),
            ...task,
            id,
          },
        })
        return id
      },
      updateTask: (id, patch) => dispatch({ type: 'update', id, patch }),
      removeTask: (id) => dispatch({ type: 'remove', id }),
      clearFinished: () => dispatch({ type: 'clearFinished' }),
    }),
    [tasks]
  )

  return <BackgroundTasksContext.Provider value={api}>{children}</BackgroundTasksContext.Provider>
}

export function useBackgroundTasks(): BackgroundTasksApi {
  const ctx = useContext(BackgroundTasksContext)
  if (!ctx) {
    throw new Error('useBackgroundTasks must be used within a BackgroundTasksProvider')
  }
  return ctx
}

'use client'
import { useState, useCallback, useEffect } from 'react'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { chaveDoUsuario } from '@components/Hooks/chaveDoUsuario'

export type OnboardingStep = {
  id: string
  title: string
  description: string
  // CTA label + where it goes. `hrefType: 'root'` targets the org's public site
  // (the shareable school), everything else is a /dash/* path.
  action: string
  href: string
  hrefType?: 'org' | 'root'
  // Steps with no navigable completion signal complete when their CTA is clicked.
  completeOnClick?: boolean
  // Regex (source string) on the pathname that auto-completes the step.
  completePath?: string
  completed: boolean
  requiredPlan?: string
  skipped?: boolean
}

type OnboardingState = {
  completedSteps: string[]
  skippedSteps: string[]
  minimized: boolean
  expanded: boolean
  showAllSteps: boolean
  dismissed: boolean
  welcomeSeen: boolean
}

const STORAGE_KEY = 'lh_onboarding'

// Outcome-framed onboarding: 6 milestones that ladder toward the north-star —
// your first enrolled learner — then retention. Each title is the WIN; the
// action is just the means. Every step delivers value on the free plan.
const DEFAULT_STEPS: Omit<OnboardingStep, 'completed'>[] = [
  {
    id: 'create_course',
    title: 'Your first course is live',
    description: 'Publish a course so there’s something real for learners to enroll in.',
    action: 'Create a course',
    href: '/dash/courses?new=true',
    completePath: '/dash/courses/course/[^/]+/general',
  },
  {
    id: 'add_content',
    title: 'A lesson worth showing up for',
    description: 'Add a video, page or quiz — give learners a real reason to enroll.',
    action: 'Add content',
    href: '/dash/courses',
    completePath: '/dash/courses/course/[^/]+/content',
  },
  {
    id: 'brand_school',
    title: 'A school learners trust',
    description: 'Add your logo and colors so it looks like a credible, professional school.',
    action: 'Brand it',
    href: '/dash/org/settings/general',
    completePath: '/dash/org/settings/(general|branding)',
  },
  {
    id: 'share_grow',
    title: 'Your school’s front door',
    description: 'Go live and grab your shareable link — the place you’ll send every learner.',
    action: 'Open my school',
    href: '/',
    hrefType: 'root',
    completeOnClick: true,
  },
  {
    id: 'invite_learners',
    title: 'Welcome your first learner',
    description: 'Share your join link or invite people — get that first learner through the door.',
    action: 'Invite learners',
    href: '/dash/users/settings/add',
    completePath: '/dash/users/settings/add',
  },
  {
    id: 'build_community',
    title: 'Keep learners coming back',
    description: 'Open a community space so your learners stay active — and bring their friends.',
    action: 'Open community',
    href: '/dash/communities',
    completePath: '/dash/communities',
  },
]

// Raw step definitions (incl. completion-path regexes) for the headless tracker.
export const ONBOARDING_STEP_DEFS = DEFAULT_STEPS

function loadState(chave: string | null): OnboardingState {
  if (typeof window === 'undefined' || !chave) {
    return { completedSteps: [], skippedSteps: [], minimized: false, expanded: false, showAllSteps: false, dismissed: false, welcomeSeen: false }
  }
  try {
    // 572: a gaveta antiga, sem dono, sai (não dá para saber de quem era).
    localStorage.removeItem(STORAGE_KEY)
    const raw = localStorage.getItem(chave)
    if (raw) {
      const parsed = JSON.parse(raw)
      return {
        completedSteps: parsed.completedSteps || [],
        skippedSteps: parsed.skippedSteps || [],
        minimized: parsed.minimized || false,
        expanded: parsed.expanded || false,
        showAllSteps: parsed.showAllSteps || false,
        dismissed: parsed.dismissed || false,
        welcomeSeen: parsed.welcomeSeen || false,
      }
    }
  } catch {
    /* ignore */
  }
  return { completedSteps: [], skippedSteps: [], minimized: false, expanded: false, showAllSteps: false, dismissed: false, welcomeSeen: false }
}

function saveState(chave: string | null, state: OnboardingState) {
  if (!chave) return
  try {
    localStorage.setItem(chave, JSON.stringify(state))
    window.dispatchEvent(new Event('lh_onboarding_change'))
  } catch {
    /* ignore */
  }
}

export function useOnboarding() {
  const session = useLHSession() as any
  const chave = chaveDoUsuario(STORAGE_KEY, session?.data?.user?.id)
  const [state, setState] = useState<OnboardingState>(() => loadState(chave))

  // 572: a sessão chegou ou trocou de conta, então lê a gaveta da conta certa.
  useEffect(() => {
    setState(loadState(chave))
  }, [chave])

  const applyLocalChange = useCallback(
    (updater: (_prev: OnboardingState) => OnboardingState) => {
      setState((prev) => {
        const next = updater(prev)
        if (next !== prev) {
          saveState(chave, next)
        }
        return next
      })
    },
    [chave]
  )

  // Listen for changes from other instances of this hook
  useEffect(() => {
    const handler = () => {
      setState((prev) => {
        const loaded = loadState(chave)
        if (JSON.stringify(loaded) === JSON.stringify(prev)) return prev
        return loaded
      })
    }
    window.addEventListener('lh_onboarding_change', handler)
    return () => window.removeEventListener('lh_onboarding_change', handler)
  }, [chave])

  const steps: OnboardingStep[] = DEFAULT_STEPS.map((s) => ({
    ...s,
    completed: state.completedSteps.includes(s.id) || state.skippedSteps.includes(s.id),
    skipped: state.skippedSteps.includes(s.id),
  }))

  const currentStepIndex = steps.findIndex((s) => !s.completed)
  const currentStep = currentStepIndex >= 0 ? steps[currentStepIndex] : null
  const allCompleted = steps.every((s) => s.completed)
  const progress = steps.length > 0 ? steps.filter((s) => s.completed).length / steps.length : 0

  const completeStep = useCallback((stepId: string) => {
    applyLocalChange((prev) => {
      if (prev.completedSteps.includes(stepId)) return prev
      return { ...prev, completedSteps: [...prev.completedSteps, stepId] }
    })
  }, [applyLocalChange])

  const toggleMinimized = useCallback(() => {
    applyLocalChange((prev) => ({ ...prev, minimized: !prev.minimized }))
  }, [applyLocalChange])

  const toggleExpanded = useCallback(() => {
    applyLocalChange((prev) => ({ ...prev, expanded: !prev.expanded }))
  }, [applyLocalChange])

  const toggleShowAllSteps = useCallback(() => {
    applyLocalChange((prev) => ({ ...prev, showAllSteps: !prev.showAllSteps }))
  }, [applyLocalChange])

  const dismiss = useCallback(() => {
    applyLocalChange((prev) => (prev.dismissed ? prev : { ...prev, dismissed: true }))
  }, [applyLocalChange])

  const markWelcomeSeen = useCallback(() => {
    applyLocalChange((prev) => (prev.welcomeSeen ? prev : { ...prev, welcomeSeen: true }))
  }, [applyLocalChange])

  const skipStep = useCallback((stepId: string) => {
    applyLocalChange((prev) => {
      if (prev.skippedSteps.includes(stepId)) return prev
      return { ...prev, skippedSteps: [...prev.skippedSteps, stepId] }
    })
  }, [applyLocalChange])

  const reset = useCallback(() => {
    applyLocalChange(() => ({ completedSteps: [], skippedSteps: [], minimized: false, expanded: false, showAllSteps: false, dismissed: false, welcomeSeen: false }))
  }, [applyLocalChange])

  return {
    steps,
    currentStep,
    currentStepIndex,
    allCompleted,
    progress,
    minimized: state.minimized,
    expanded: state.expanded,
    showAllSteps: state.showAllSteps,
    dismissed: state.dismissed,
    welcomeSeen: state.welcomeSeen,
    completeStep,
    dismiss,
    markWelcomeSeen,
    toggleMinimized,
    toggleExpanded,
    toggleShowAllSteps,
    skipStep,
    reset,
  }
}

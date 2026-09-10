import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, BookOpen, Check, HelpCircle, Play, RotateCcw } from 'lucide-react'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { useIsMobile } from '@/hooks/use-mobile'
import { canAccess } from '@/lib/permissions'
import type { AuthUser, PermissionModule } from '@/types/auth'

export const ADMIN_GUIDE_VERSION = 1

export type AdminTabId = 'dashboard' | 'products' | 'team' | 'inquiries' | 'media' | 'cms' | 'workers' | 'settings'

interface VisibleNavItem {
  id: AdminTabId
  label: string
  permission?: PermissionModule
}

interface AdminHelpTourProps {
  activeTab: AdminTabId
  helpOpen: boolean
  ready: boolean
  user: AuthUser
  visibleNavItems: readonly VisibleNavItem[]
  onHelpOpenChange: (open: boolean) => void
  onPersistProgress: (completed: boolean) => Promise<void>
}

interface TourStep {
  title: string
  description: string
  target?: string
}

const moduleHelp: Record<AdminTabId, { description: string; manageAction: string; viewAction: string }> = {
  dashboard: {
    description: 'Review the latest platform totals and recent operational activity.',
    manageAction: 'Use the overview to decide which area needs attention next.',
    viewAction: 'Use the overview to monitor activity across the areas available to you.'
  },
  products: {
    description: 'Search, review and organise the public product catalogue.',
    manageAction: 'Use New Product to create a catalogue entry. Categories can be maintained separately.',
    viewAction: 'You can inspect the catalogue, but creation and editing controls remain unavailable.'
  },
  team: {
    description: 'Maintain leadership profiles and the public leadership slider behaviour.',
    manageAction: 'Use Add Executive to create a profile, then save slider settings when they change.',
    viewAction: 'You can review leadership profiles and slider settings without changing them.'
  },
  inquiries: {
    description: 'Review incoming customer requests, statuses and reply history.',
    manageAction: 'Open an inquiry to reply, acknowledge it or archive it after handling.',
    viewAction: 'You can read inquiry records, while reply and status controls remain unavailable.'
  },
  media: {
    description: 'Create and maintain company news, videos and newsletter publications.',
    manageAction: 'Use New Content to prepare a draft, preview it and publish when ready.',
    viewAction: 'You can review published and draft records without changing them.'
  },
  cms: {
    description: 'Update public website copy, media, policies and section settings.',
    manageAction: 'Choose a content section, review the preview and save only the section you changed.',
    viewAction: 'You can review website content and previews without saving changes.'
  },
  workers: {
    description: 'Review worker accounts and the access delegated to each person.',
    manageAction: 'Use Add Worker to create an account. Lineage and owner protections still apply.',
    viewAction: 'You can inspect workers available under the existing lineage rules without changing them.'
  },
  settings: {
    description: 'Maintain your own sign-in details and account security settings.',
    manageAction: 'Confirm your current password before saving account or password changes.',
    viewAction: 'Confirm your current password before saving account or password changes.'
  }
}

function visibleTarget(selector?: string) {
  if (!selector || typeof document === 'undefined') return null
  return Array.from(document.querySelectorAll<HTMLElement>(selector)).find((element) => {
    const rect = element.getBoundingClientRect()
    const style = window.getComputedStyle(element)
    return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden'
  }) || null
}

export default function AdminHelpTour({
  activeTab,
  helpOpen,
  ready,
  user,
  visibleNavItems,
  onHelpOpenChange,
  onPersistProgress
}: AdminHelpTourProps) {
  const isMobile = useIsMobile()
  const autoStarted = useRef(false)
  const cardRef = useRef<HTMLDivElement>(null)
  const [steps, setSteps] = useState<TourStep[]>([])
  const [stepIndex, setStepIndex] = useState(0)
  const [persistOnExit, setPersistOnExit] = useState(false)
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null)
  const running = steps.length > 0
  const currentHelp = moduleHelp[activeTab]
  const activeNavItem = visibleNavItems.find((item) => item.id === activeTab)
  const canManagePage = activeNavItem?.permission
    ? canAccess(user, activeNavItem.permission, 'manage')
    : true

  const availableLabels = useMemo(
    () => visibleNavItems.filter((item) => item.id !== 'settings').map((item) => item.label).join(', '),
    [visibleNavItems]
  )

  const buildQuickTour = useCallback((): TourStep[] => [
    {
      title: `Welcome, ${user.fullName || user.username}`,
      description: 'This short guide introduces the administration portal. It never changes content while you move through it.'
    },
    {
      target: '[data-help-target="admin-navigation"]',
      title: 'Your workspace',
      description: `Your navigation reflects your assigned access. Available areas: ${availableLabels || 'account settings'}.`
    },
    {
      target: '[data-help-target="admin-page"]',
      title: 'Work one section at a time',
      description: 'Each section keeps its controls and records together. View access is read-only; Manage access enables approved changes.'
    },
    {
      target: '[data-help-target="settings-navigation"], [data-help-target="admin-navigation"]',
      title: 'Protect your account',
      description: 'Settings is always available for maintaining your own username and password. Sensitive changes require your current password.'
    },
    {
      target: '[data-help-target="admin-help"]',
      title: 'Help remains available',
      description: 'Open Help at any time to replay this introduction or receive guidance for the page you are currently using.'
    }
  ], [availableLabels, user.fullName, user.username])

  const startTour = useCallback((nextSteps: TourStep[], persist: boolean) => {
    onHelpOpenChange(false)
    setPersistOnExit(persist)
    setStepIndex(0)
    setSteps(nextSteps)
  }, [onHelpOpenChange])

  const startQuickTour = useCallback((persist = false) => {
    startTour(buildQuickTour(), persist)
  }, [buildQuickTour, startTour])

  const startPageTour = useCallback(() => {
    const nextSteps: TourStep[] = [
      {
        target: '[data-help-target="admin-page"]',
        title: activeNavItem?.label || 'Current page',
        description: currentHelp.description
      }
    ]

    const primaryAction = visibleTarget('[data-help-target="primary-action"]')
    if (primaryAction && canManagePage) {
      nextSteps.push({
        target: '[data-help-target="primary-action"]',
        title: 'Primary action',
        description: currentHelp.manageAction
      })
    } else {
      nextSteps.push({
        target: '[data-help-target="admin-page"]',
        title: canManagePage ? 'Working safely' : 'View-only access',
        description: canManagePage ? currentHelp.manageAction : currentHelp.viewAction
      })
    }

    nextSteps.push({
      target: '[data-help-target="admin-help"]',
      title: 'Return to Help',
      description: 'You can reopen this page guide whenever you need a reminder.'
    })
    startTour(nextSteps, false)
  }, [activeNavItem?.label, canManagePage, currentHelp, startTour])

  const closeTour = useCallback((completed: boolean) => {
    const shouldPersist = persistOnExit
    setSteps([])
    setStepIndex(0)
    setTargetRect(null)
    if (shouldPersist) void onPersistProgress(completed)
  }, [onPersistProgress, persistOnExit])

  useEffect(() => {
    if (!ready || autoStarted.current || user.mustChangePassword || user.adminGuideVersionSeen >= ADMIN_GUIDE_VERSION) return
    autoStarted.current = true
    const startTimer = window.setTimeout(() => startQuickTour(true), 0)
    return () => window.clearTimeout(startTimer)
  }, [ready, startQuickTour, user.adminGuideVersionSeen, user.mustChangePassword])

  useEffect(() => {
    if (!running) return
    const step = steps[stepIndex]
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let target = visibleTarget(step.target)

    if (step.target && !target) {
      const skipTimer = window.setTimeout(() => {
        if (stepIndex < steps.length - 1) setStepIndex((current) => current + 1)
        else closeTour(true)
      }, 0)
      return () => window.clearTimeout(skipTimer)
    }

    target?.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'center', inline: 'nearest' })
    const updatePosition = () => {
      target = visibleTarget(step.target)
      setTargetRect(target?.getBoundingClientRect() || null)
    }
    updatePosition()
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    cardRef.current?.focus({ preventScroll: true })
    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [closeTour, running, stepIndex, steps])

  useEffect(() => {
    if (!running) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeTour(false)
      if (event.key === 'ArrowRight' && stepIndex < steps.length - 1) setStepIndex((current) => current + 1)
      if (event.key === 'ArrowLeft' && stepIndex > 0) setStepIndex((current) => current - 1)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [closeTour, running, stepIndex, steps.length])

  const tooltipStyle = useMemo(() => {
    if (isMobile || !targetRect) return undefined
    const width = 320
    const gap = 16
    const left = targetRect.right + width + gap <= window.innerWidth
      ? targetRect.right + gap
      : Math.max(16, targetRect.left - width - gap)
    const top = Math.min(Math.max(16, targetRect.top), Math.max(16, window.innerHeight - 260))
    return { left, top, width }
  }, [isMobile, targetRect])

  const step = steps[stepIndex]

  return (
    <>
      <Sheet open={helpOpen} onOpenChange={onHelpOpenChange}>
        <SheetContent
          side={isMobile ? 'bottom' : 'right'}
          className={`${isMobile ? 'max-h-[82vh] rounded-t-2xl' : 'w-full sm:max-w-[390px]'} border-[#102B4C]/10 bg-white p-0`}
        >
          <SheetHeader className="border-b border-[#102B4C]/8 px-6 py-5 text-left">
            <div className="flex items-center gap-2 text-[9px] font-semibold uppercase tracking-[0.2em] text-[#D64545]">
              <HelpCircle size={13} /> Admin guidance
            </div>
            <SheetTitle className="mt-2 text-lg font-semibold tracking-tight text-[#102B4C]">Help and walkthroughs</SheetTitle>
            <SheetDescription className="text-[11px] leading-5 text-[#102B4C]/50">Short guidance based on your access and the page currently open.</SheetDescription>
          </SheetHeader>

          <div className="overflow-y-auto px-6 py-5 [scrollbar-width:thin]">
            <section className="rounded-xl border border-[#102B4C]/9 bg-[#F7F9FC] p-4">
              <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-[#060273]">Current page</p>
              <h3 className="mt-2 text-[13px] font-semibold text-[#102B4C]">{activeNavItem?.label || 'Administration'}</h3>
              <p className="mt-2 text-[11px] leading-5 text-[#102B4C]/55">{currentHelp.description}</p>
              <p className="mt-3 border-t border-[#102B4C]/8 pt-3 text-[10px] leading-5 text-[#102B4C]/45">
                {canManagePage ? currentHelp.manageAction : currentHelp.viewAction}
              </p>
            </section>

            <div className="mt-5 space-y-2">
              <button onClick={() => startQuickTour(false)} className="flex w-full items-center gap-3 rounded-lg border border-[#102B4C]/10 px-4 py-3 text-left transition hover:bg-[#F7F9FC]">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[#060273] text-white"><Play size={13} /></span>
                <span><span className="block text-[11px] font-semibold text-[#102B4C]">Quick admin tour</span><span className="mt-0.5 block text-[9px] text-[#102B4C]/42">Navigation, access and account safety</span></span>
              </button>
              <button onClick={startPageTour} className="flex w-full items-center gap-3 rounded-lg border border-[#102B4C]/10 px-4 py-3 text-left transition hover:bg-[#F7F9FC]">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[#102B4C]/7 text-[#102B4C]"><BookOpen size={14} /></span>
                <span><span className="block text-[11px] font-semibold text-[#102B4C]">Tour this page</span><span className="mt-0.5 block text-[9px] text-[#102B4C]/42">Explain the controls available here</span></span>
              </button>
              <button onClick={() => startQuickTour(false)} className="flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left text-[#102B4C]/60 transition hover:bg-[#F7F9FC]">
                <RotateCcw size={14} /> <span className="text-[10px] font-medium">Restart the introductory tour</span>
              </button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {running && step && (
        <div className="fixed inset-0 z-[250] pointer-events-none" aria-live="polite">
          <div className="absolute inset-0 bg-[#102B4C]/18" />
          {targetRect && (
            <div
              aria-hidden="true"
              className="absolute rounded-xl border-2 border-[#D64545] bg-transparent shadow-[0_0_0_9999px_rgba(16,43,76,0.16)] transition-[left,top,width,height] duration-200 motion-reduce:transition-none"
              style={{ left: targetRect.left - 6, top: targetRect.top - 6, width: targetRect.width + 12, height: targetRect.height + 12 }}
            />
          )}
          <div
            ref={cardRef}
            role="dialog"
            aria-label={step.title}
            tabIndex={-1}
            className={`${isMobile ? 'absolute inset-x-3 bottom-[max(12px,env(safe-area-inset-bottom))]' : targetRect ? 'absolute' : 'absolute left-1/2 top-1/2 w-[320px] -translate-x-1/2 -translate-y-1/2'} pointer-events-auto max-h-[min(70vh,360px)] overflow-y-auto rounded-xl border border-[#102B4C]/12 bg-white p-5 shadow-[0_24px_70px_rgba(16,43,76,0.22)] outline-none [scrollbar-width:thin]`}
            style={isMobile || !targetRect ? undefined : tooltipStyle}
          >
            <div className="flex items-center justify-between gap-4">
              <span className="text-[9px] font-semibold uppercase tracking-[0.18em] text-[#D64545]">{stepIndex + 1} of {steps.length}</span>
              <button onClick={() => closeTour(false)} className="rounded-md px-2 py-1 text-[9px] font-medium text-[#102B4C]/45 hover:bg-[#F5F8FC] hover:text-[#102B4C]">Skip</button>
            </div>
            <h2 className="mt-3 text-[15px] font-semibold tracking-tight text-[#102B4C]">{step.title}</h2>
            <p className="mt-2 text-[11px] leading-5 text-[#102B4C]/58">{step.description}</p>
            <div className="mt-5 flex items-center justify-between gap-3 border-t border-[#102B4C]/8 pt-4">
              <button
                onClick={() => setStepIndex((current) => Math.max(0, current - 1))}
                disabled={stepIndex === 0}
                className="inline-flex items-center gap-1.5 rounded-md px-2 py-2 text-[10px] font-medium text-[#102B4C]/55 disabled:invisible"
              >
                <ArrowLeft size={13} /> Back
              </button>
              {stepIndex === steps.length - 1 ? (
                <button onClick={() => closeTour(true)} className="inline-flex items-center gap-2 rounded-md bg-[#060273] px-4 py-2.5 text-[10px] font-semibold text-white">
                  <Check size={13} /> Finish
                </button>
              ) : (
                <button onClick={() => setStepIndex((current) => current + 1)} className="inline-flex items-center gap-2 rounded-md bg-[#060273] px-4 py-2.5 text-[10px] font-semibold text-white">
                  Next <ArrowRight size={13} />
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

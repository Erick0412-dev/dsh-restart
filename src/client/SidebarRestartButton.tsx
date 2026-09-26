/**
 * Persistent restart action in the sidebar footer rail.
 *
 * The settings tab configures restart behaviour; this button is the
 * always-available trigger. It reuses the settings card's own restart path
 * (restartAndWait in restart-monitor), so it adds no Host surface of its own:
 * the Web route it calls is fenced by Connection's Host/Origin and browser-auth
 * check exactly like the rest of the app, which is also why it keeps working
 * when the browser reaches DSH through a reverse proxy.
 */
import { useEffect, useRef, useState } from 'react'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type { SidebarFooterActionOwnerProps } from './slot-contracts.ts'
import { restartAndWait } from './restart-monitor.ts'
import { ensureStyles, styles as css } from './styles.ts'

/** How long a failed attempt stays visible before the button returns to idle. */
const RESET_MS = 8000

type ButtonPhase = 'idle' | 'busy' | 'failed'

export interface SidebarRestartButtonProps extends SidebarFooterActionOwnerProps, PropsLocale<'restart.card'> {}

/** Restart the Host, reloading the page once the new process answers. */
export function SidebarRestartButton({ wide, t }: SidebarRestartButtonProps) {
  ensureStyles()
  const [phase, setPhase] = useState<ButtonPhase>('idle')
  const [detail, setDetail] = useState('')
  const resetTimer = useRef<number | null>(null)
  const controller = useRef<AbortController | null>(null)

  useEffect(() => () => {
    if (resetTimer.current !== null) window.clearTimeout(resetTimer.current)
    controller.current?.abort()
  }, [])

  const onClick = (): void => {
    if (phase === 'busy') return
    setPhase('busy')
    setDetail('')
    const aborter = new AbortController()
    controller.current = aborter
    const fail = (reason: string): void => {
      if (aborter.signal.aborted) return
      setPhase('failed')
      setDetail(reason)
      if (resetTimer.current !== null) window.clearTimeout(resetTimer.current)
      resetTimer.current = window.setTimeout(() => {
        resetTimer.current = null
        setPhase('idle')
      }, RESET_MS)
    }
    void restartAndWait({ signal: aborter.signal, isVisible: () => document.visibilityState === 'visible' })
      .then((outcome) => {
        if (outcome === 'restarted') {
          window.location.reload()
          return
        }
        fail(t('restartStale'))
      })
      .catch((error: unknown) => {
        fail(error instanceof Error ? error.message : String(error))
      })
  }

  const busy = phase === 'busy'
  const failed = phase === 'failed'
  const label = busy ? t('sidebarRestarting') : failed ? t('sidebarFailed') : t('sidebarTitle')
  const className = [
    css.sidebarButton,
    wide ? css.sidebarButtonWide : '',
    busy ? css.sidebarButtonBusy : '',
    failed ? css.sidebarButtonFailed : '',
  ].filter(Boolean).join(' ')

  return (
    <button
      type="button"
      className={className}
      aria-label={label}
      title={failed && detail !== '' ? label + ': ' + detail : label}
      disabled={busy}
      onClick={onClick}
    >
      <span aria-hidden="true" className={busy ? css.sidebarSpin : undefined}>{'\u21BB'}</span>
      {wide ? <span className={css.sidebarText}>{label}</span> : null}
    </button>
  )
}

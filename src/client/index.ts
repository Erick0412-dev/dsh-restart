/**
 * dsh-restart — client half.
 *
 * One surface: 'settings.section', the plugin's own page in the settings
 * navigation. DSH 0.1.7 replaced the 0.1.5 'settings.plugin.item' card list with
 * list slots, which is why the 0.1.5-era build rendered nothing at all.
 *
 * It registers an additive list slot, so other plugins stack beside it instead of
 * competing for the cell, and every restart it offers goes through the
 * confirmation gate in restart-action.ts.
 */
import type { Context } from './context-types.ts'
import { createSnapshotStore, type SnapshotStore } from '@deepseek-ai/dsh-client-store'
import type { SettingsScope } from '@deepseek-ai/dsh-client-ui-settings/client'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import { ConfirmDialogSurface } from './RestartConfirmDialog.tsx'
import { RestartSection } from './RestartSection.tsx'
import { reduceRestartPhase } from './restart-action.ts'
import { en, zh } from './locales.ts'
import { ensureStyles } from './styles.ts'
import type { SettingsSectionOwnerProps } from './slot-contracts.ts'

export const name = 'dsh-restart-client'
export const inject = ['slots', 'locale', 'settingsScope']
export const NS = 'restart.card'

/** The slice of the host's settings the UI projects. */
export interface RestartCardState {
  /** The settings service has a ready value for this namespace. */
  available: boolean
  writable: boolean
  legacyRestart: boolean
  continuePrompt: string
}

/** Props of the registered settings page. */
export type RestartSectionProps = SettingsSectionOwnerProps & PropsLocale<typeof NS> & {
  useDshRestart: <R>(selector: (snapshot: RestartCardState) => R) => R
  set: (field: string, value: unknown) => void
  clear: (field: string) => void
}

/** Seams the test suite exercises directly (the bundle exposes no other one). */
export const internals = { ConfirmDialogSurface, reduceRestartPhase }

/**
 * Wire the three surfaces up to the host settings namespace.
 * @param ctx - the client cordis context.
 */
export function apply(ctx: Context): void {
  ensureStyles()
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-restart: dictionaries')

  const scope = ctx.settingsScope.bind({ namespace: 'dsh-restart' }) as SettingsScope<unknown>
  const t = ctx.locale.bind(NS)

  const project = (): RestartCardState => {
    const snap = scope.getSnapshot()
    const value = (snap.value ?? {}) as Record<string, unknown>
    return {
      available: snap.status === 'ready',
      writable: snap.writable,
      legacyRestart: value.legacyRestart === true,
      continuePrompt: typeof value.continuePrompt === 'string' ? value.continuePrompt : '',
    }
  }

  const store: SnapshotStore<RestartCardState> = createSnapshotStore(project())
  scope.subscribe(() => { store.set(project()) })

  const hooksOnly = (): { hooks: { dshRestart: SnapshotStore<RestartCardState> } } => ({
    hooks: { dshRestart: store },
  })

  // Own settings page. The nav row reads its label through resolveSlotLabel, so
  // the thunk keeps the text following the active locale.
  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section',
    id: 'dsh-restart',
    order: 50,
    label: () => t('title'),
    locale: NS,
    inject: () => ({
      ...hooksOnly(),
      set: (field: string, value: unknown) => { void scope.set(field, value) },
      clear: (field: string) => { void scope.unset(field) },
    }),
  }, RestartSection))

}

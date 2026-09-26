/**
 * dsh-restart — client half: a settings tab page (设置 → 插件, where DSH 0.1.7
 * replaced the configurable-plugin card list with a tab strip) plus a
 * persistent restart button in the sidebar footer rail. Both are bound to the
 * dsh-restart settings namespace, so edits persist to settings.yaml and the
 * Host reads them back through installSettingsSection.
 */
import type { Context } from './context-types.ts'
import { createSnapshotStore, type SnapshotStore } from '@deepseek-ai/dsh-client-store'
import type { SettingsScope } from '@deepseek-ai/dsh-client-ui-settings/client'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import { SettingsCard } from './SettingsCard.tsx'
import { SidebarRestartButton } from './SidebarRestartButton.tsx'
import { en, zh } from './locales.ts'
import { ensureStyles } from './styles.ts'

export const name = 'dsh-restart-client'
export const inject = ['slots', 'locale', 'settingsScope']
export const NS = 'restart.card'

export interface RestartCardState {
  available: boolean
  writable: boolean
  legacyRestart: boolean
  continuePrompt: string
}

export type SettingsCardProps = PropsLocale<typeof NS> & {
  useDshRestart: <R>(selector: (snapshot: RestartCardState) => R) => R
  set: (field: string, value: unknown) => void
  clear: (field: string) => void
}

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

  // Own tab page inside the Plugins settings section. The section renders a
  // tab strip from this list slot (label + id are required by the host); the
  // card body itself is unchanged.
  ctx.slots.inject('settings.plugins.tab', () => ctx.slots.register({
    name: 'settings.plugins.tab',
    id: 'dsh-restart',
    order: 10,
    label: () => t('title'),
    locale: NS,
    inject: () => ({
      hooks: { dshRestart: store },
      set: (field: string, value: unknown) => { void scope.set(field, value) },
      clear: (field: string) => { void scope.unset(field) },
    }),
  }, SettingsCard))

  // Persistent restart button in the sidebar footer rail. The slot itself is
  // declared by the core sidebar package; slots.inject defers this registration
  // until that declaration exists, so bundle load order does not matter.
  ctx.slots.inject('sidebar.footer.action', () => ctx.slots.register({
    name: 'sidebar.footer.action',
    id: 'dsh-restart',
    order: 30,
    locale: NS,
  }, SidebarRestartButton))
}

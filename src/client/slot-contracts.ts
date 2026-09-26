/**
 * Local slot contracts for the two surfaces this plugin contributes to.
 *
 * 'settings.plugins.tab' is declared at runtime by the Plugins settings
 * section, but that package publishes no SlotMap merge for third-party tab
 * pages, so every contributor declares its own entry: the section reads
 * id/order/label from these registrations to build the tab strip. The
 * 'sidebar.footer.action' slot is owned by the core sidebar package, which is
 * not a dependency of this plugin at all. Both entries are merged into SlotMap
 * here, mirroring the shapes DSH 0.1.5-0.1.7 render. Merging cannot conflict:
 * neither key is declared inside this program anywhere else.
 */
import type {} from '@deepseek-ai/dsh-client-ui-slots'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface SlotMap {
    /** One feature page inside the Plugins settings section (tab strip). */
    'settings.plugins.tab': {
      kind: 'list'
      scope: 'root'
      owner: { children?: never }
    }
    /** Persistent action button in the main sidebar's footer rail. */
    'sidebar.footer.action': {
      kind: 'list'
      scope: 'root'
      owner: SidebarFooterActionOwnerProps
    }
  }
}

/** Owner share the sidebar supplies to each footer action entry. */
export interface SidebarFooterActionOwnerProps {
  /** True while the sidebar is expanded; false on the collapsed icon rail. */
  wide: boolean
}

declare module '@deepseek-ai/dsh-client-ui-slots' {
    interface SlotMap {
        /** One feature page inside the Plugins settings section (tab strip). */
        'settings.plugins.tab': {
            kind: 'list';
            scope: 'root';
            owner: {
                children?: never;
            };
        };
        /** Persistent action button in the main sidebar's footer rail. */
        'sidebar.footer.action': {
            kind: 'list';
            scope: 'root';
            owner: SidebarFooterActionOwnerProps;
        };
    }
}
/** Owner share the sidebar supplies to each footer action entry. */
export interface SidebarFooterActionOwnerProps {
    /** True while the sidebar is expanded; false on the collapsed icon rail. */
    wide: boolean;
}

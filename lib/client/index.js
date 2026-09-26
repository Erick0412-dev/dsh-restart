import { createSnapshotStore } from '@deepseek-ai/dsh-client-store';
import { SettingsCard } from "./SettingsCard.js";
import { SidebarRestartButton } from "./SidebarRestartButton.js";
import { en, zh } from "./locales.js";
import { ensureStyles } from "./styles.js";
export const name = 'dsh-restart-client';
export const inject = ['slots', 'locale', 'settingsScope'];
export const NS = 'restart.card';
export function apply(ctx) {
    ensureStyles();
    ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-restart: dictionaries');
    const scope = ctx.settingsScope.bind({ namespace: 'dsh-restart' });
    const t = ctx.locale.bind(NS);
    const project = () => {
        const snap = scope.getSnapshot();
        const value = (snap.value ?? {});
        return {
            available: snap.status === 'ready',
            writable: snap.writable,
            legacyRestart: value.legacyRestart === true,
            continuePrompt: typeof value.continuePrompt === 'string' ? value.continuePrompt : '',
        };
    };
    const store = createSnapshotStore(project());
    scope.subscribe(() => { store.set(project()); });
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
            set: (field, value) => { void scope.set(field, value); },
            clear: (field) => { void scope.unset(field); },
        }),
    }, SettingsCard));
    // Persistent restart button in the sidebar footer rail. The slot itself is
    // declared by the core sidebar package; slots.inject defers this registration
    // until that declaration exists, so bundle load order does not matter.
    ctx.slots.inject('sidebar.footer.action', () => ctx.slots.register({
        name: 'sidebar.footer.action',
        id: 'dsh-restart',
        order: 30,
        locale: NS,
    }, SidebarRestartButton));
}

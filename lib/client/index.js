import { createSnapshotStore } from '@deepseek-ai/dsh-client-store';
import { ConfirmDialogSurface } from "./RestartConfirmDialog.js";
import { RestartSection } from "./RestartSection.js";
import { reduceRestartPhase } from "./restart-action.js";
import { en, zh } from "./locales.js";
import { ensureStyles } from "./styles.js";
export const name = 'dsh-restart-client';
export const inject = ['slots', 'locale', 'settingsScope'];
export const NS = 'restart.card';
/** Seams the test suite exercises directly (the bundle exposes no other one). */
export const internals = { ConfirmDialogSurface, reduceRestartPhase };
/**
 * Wire the three surfaces up to the host settings namespace.
 * @param ctx - the client cordis context.
 */
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
    const hooksOnly = () => ({
        hooks: { dshRestart: store },
    });
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
            set: (field, value) => { void scope.set(field, value); },
            clear: (field) => { void scope.unset(field); },
        }),
    }, RestartSection));
}

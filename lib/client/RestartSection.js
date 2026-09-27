import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * The dsh-restart settings page: 设置 → DSH 重启.
 *
 * Registered into `settings.section`, which gives this plugin its own row in
 * the settings navigation (the 0.1.7 replacement for the per-plugin card list
 * that 0.1.5 rendered from `settings.plugin.item`) and a full page to lay out
 * its restart behaviour. Everything it edits is the host's own settings
 * namespace, so the values round-trip through settings.yaml.
 *
 * The restart button here goes through the same confirmation gate as the main
 * panel entries: this page can restart the process the page is running in.
 */
import { useEffect, useState } from 'react';
import { RestartConfirmDialog } from "./RestartConfirmDialog.js";
import { consumeRestartCompleted } from "./restart-marker.js";
import { useRestartAction } from "./restart-action.js";
import { ensureStyles, styles as css } from "./styles.js";
/** How long the "restarted" confirmation stays on the page after a reload. */
const SUCCESS_MS = 5000;
/** The dsh-restart settings page. */
export function RestartSection(props) {
    ensureStyles();
    const { t, set, clear, useDshRestart } = props;
    const state = useDshRestart(snapshot => snapshot);
    const restart = useRestartAction();
    const [completed, setCompleted] = useState(consumeRestartCompleted);
    useEffect(() => {
        if (!completed)
            return;
        const timer = window.setTimeout(() => { setCompleted(false); }, SUCCESS_MS);
        return () => { window.clearTimeout(timer); };
    }, [completed]);
    if (!state.available)
        return null;
    const disabled = !state.writable;
    const busy = restart.phase === 'busy';
    const writeText = (field, value) => {
        if (value.trim() === '')
            clear(field);
        else
            set(field, value.trim());
    };
    const status = restart.phase === 'failed'
        ? (restart.stale ? t('restartStale') : t('restartFailed'))
        : completed ? t('restartSucceeded') : t('restartHint');
    return (_jsxs("div", { className: css.page, children: [_jsx("h2", { className: css.pageTitle, children: t('title') }), _jsx("p", { className: css.pageDescription, children: t('description') }), state.writable ? null : _jsx("p", { className: css.readOnly, role: "status", children: t('readOnly') }), _jsxs("div", { className: css.rows, children: [_jsxs("label", { className: css.row + ' ' + css.toggleField, children: [_jsx("input", { className: css.checkbox, type: "checkbox", checked: state.legacyRestart, disabled: disabled, onChange: event => { set('legacyRestart', event.currentTarget.checked); } }), _jsxs("span", { className: css.toggleCopy, children: [_jsx("span", { className: css.label, children: t('legacyRestart') }), _jsx("span", { className: css.hint, children: t('legacyRestartHint') })] })] }), _jsxs("label", { className: css.row + ' ' + css.field, htmlFor: "dsh-restart-continue-prompt", children: [_jsx("span", { className: css.label, children: t('continuePrompt') }), _jsx("input", { id: "dsh-restart-continue-prompt", className: css.input, type: "text", value: state.continuePrompt, disabled: disabled, onChange: event => { writeText('continuePrompt', event.currentTarget.value); } }), _jsx("span", { className: css.hint, children: t('continuePromptHint') })] })] }), _jsxs("div", { className: css.rows, children: [_jsx("p", { className: css.groupTitle, children: t('quickSection') }), _jsxs("label", { className: css.row + ' ' + css.toggleField, children: [_jsx("input", { className: css.checkbox, type: "checkbox", checked: state.quickRestartSidebar, disabled: disabled, onChange: event => { set('quickRestartSidebar', event.currentTarget.checked); } }), _jsxs("span", { className: css.toggleCopy, children: [_jsx("span", { className: css.label, children: t('quickSidebar') }), _jsx("span", { className: css.hint, children: t('quickSidebarHint') })] })] }), _jsxs("label", { className: css.row + ' ' + css.toggleField, children: [_jsx("input", { className: css.checkbox, type: "checkbox", checked: state.quickRestartHeader, disabled: disabled, onChange: event => { set('quickRestartHeader', event.currentTarget.checked); } }), _jsxs("span", { className: css.toggleCopy, children: [_jsx("span", { className: css.label, children: t('quickHeader') }), _jsx("span", { className: css.hint, children: t('quickHeaderHint') })] })] })] }), _jsxs("div", { className: css.footer, children: [_jsx("p", { className: restart.phase === 'failed' ? css.failed : css.actionHint, role: "status", "aria-live": "polite", children: busy ? t('restarting') : status }), _jsx("button", { type: "button", className: css.restart, disabled: busy, "aria-haspopup": "dialog", onClick: restart.request, children: t(busy ? 'restarting' : 'restartNow') })] }), restart.phase === 'confirming'
                ? _jsx(RestartConfirmDialog, { t: t, busy: busy, onConfirm: restart.confirm, onCancel: restart.cancel })
                : null] }));
}

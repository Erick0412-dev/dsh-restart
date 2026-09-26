import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
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
import { useEffect, useRef, useState } from 'react';
import { restartAndWait } from "./restart-monitor.js";
import { ensureStyles, styles as css } from "./styles.js";
/** How long a failed attempt stays visible before the button returns to idle. */
const RESET_MS = 8000;
/** Restart the Host, reloading the page once the new process answers. */
export function SidebarRestartButton({ wide, t }) {
    ensureStyles();
    const [phase, setPhase] = useState('idle');
    const [detail, setDetail] = useState('');
    const resetTimer = useRef(null);
    const controller = useRef(null);
    useEffect(() => () => {
        if (resetTimer.current !== null)
            window.clearTimeout(resetTimer.current);
        controller.current?.abort();
    }, []);
    const onClick = () => {
        if (phase === 'busy')
            return;
        setPhase('busy');
        setDetail('');
        const aborter = new AbortController();
        controller.current = aborter;
        const fail = (reason) => {
            if (aborter.signal.aborted)
                return;
            setPhase('failed');
            setDetail(reason);
            if (resetTimer.current !== null)
                window.clearTimeout(resetTimer.current);
            resetTimer.current = window.setTimeout(() => {
                resetTimer.current = null;
                setPhase('idle');
            }, RESET_MS);
        };
        void restartAndWait({ signal: aborter.signal, isVisible: () => document.visibilityState === 'visible' })
            .then((outcome) => {
            if (outcome === 'restarted') {
                window.location.reload();
                return;
            }
            fail(t('restartStale'));
        })
            .catch((error) => {
            fail(error instanceof Error ? error.message : String(error));
        });
    };
    const busy = phase === 'busy';
    const failed = phase === 'failed';
    const label = busy ? t('sidebarRestarting') : failed ? t('sidebarFailed') : t('sidebarTitle');
    const className = [
        css.sidebarButton,
        wide ? css.sidebarButtonWide : '',
        busy ? css.sidebarButtonBusy : '',
        failed ? css.sidebarButtonFailed : '',
    ].filter(Boolean).join(' ');
    return (_jsxs("button", { type: "button", className: className, "aria-label": label, title: failed && detail !== '' ? label + ': ' + detail : label, disabled: busy, onClick: onClick, children: [_jsx("span", { "aria-hidden": "true", className: busy ? css.sidebarSpin : undefined, children: '\u21BB' }), wide ? _jsx("span", { className: css.sidebarText, children: label }) : null] }));
}

/**
 * Restart-completion marker.
 *
 * A restart reloads the page, so the settings page cannot report success from
 * its own React state: the run that would report it is the run being torn down.
 * The run that arranged the restart leaves a marker in sessionStorage instead,
 * and the next page load consumes it once.
 */
const RESTART_COMPLETED_KEY = 'dsh-restart:completed';
/** Record that the restart being arranged succeeded (called just before reload). */
export function rememberRestartCompleted() {
    try {
        sessionStorage.setItem(RESTART_COMPLETED_KEY, '1');
    }
    catch {
        // A blocked sessionStorage only costs the confirmation message.
    }
}
/** Read and clear the marker; true on the first load after a successful restart. */
export function consumeRestartCompleted() {
    try {
        const completed = sessionStorage.getItem(RESTART_COMPLETED_KEY) === '1';
        if (completed)
            sessionStorage.removeItem(RESTART_COMPLETED_KEY);
        return completed;
    }
    catch {
        return false;
    }
}

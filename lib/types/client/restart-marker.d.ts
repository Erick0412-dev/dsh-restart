/** Record that the restart being arranged succeeded (called just before reload). */
export declare function rememberRestartCompleted(): void;
/** Read and clear the marker; true on the first load after a successful restart. */
export declare function consumeRestartCompleted(): boolean;

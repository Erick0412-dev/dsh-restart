import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots';
import type { SidebarFooterActionOwnerProps } from './slot-contracts.ts';
export interface SidebarRestartButtonProps extends SidebarFooterActionOwnerProps, PropsLocale<'restart.card'> {
}
/** Restart the Host, reloading the page once the new process answers. */
export declare function SidebarRestartButton({ wide, t }: SidebarRestartButtonProps): import("react").JSX.Element;

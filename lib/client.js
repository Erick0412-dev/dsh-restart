window.__ModuleLoader__.load({
	id: "dsh-restart",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let _deepseek_ai_dsh_client_store = require("@deepseek-ai/dsh-client-store");
		let react = require("react");
		let react_jsx_runtime = require("react/jsx-runtime");
		//#region src/client/restart-monitor.ts
		const RESTART_URL = "/plugins/dsh-restart/restart";
		var RestartProbeUnavailableError = class extends Error {
			constructor(message, options) {
				super(message, options);
				this.name = "RestartProbeUnavailableError";
			}
		};
		function abortError(signal) {
			return signal?.reason ?? new DOMException("The operation was aborted.", "AbortError");
		}
		function defaultSleep(delayMs, signal) {
			if (signal?.aborted) return Promise.reject(abortError(signal));
			return new Promise((resolve, reject) => {
				const onAbort = () => {
					window.clearTimeout(timer);
					signal?.removeEventListener("abort", onAbort);
					reject(abortError(signal));
				};
				const timer = window.setTimeout(() => {
					signal?.removeEventListener("abort", onAbort);
					resolve();
				}, delayMs);
				signal?.addEventListener("abort", onAbort, { once: true });
			});
		}
		function parseRestartIdentity(value) {
			const candidate = value;
			if (candidate === null || !Number.isInteger(candidate.pid) || Number(candidate.pid) <= 0 || typeof candidate.startedAt !== "string" || candidate.startedAt === "") throw new Error("invalid restart identity");
			return {
				pid: Number(candidate.pid),
				startedAt: candidate.startedAt
			};
		}
		async function fetchRestartIdentity(fetchImpl, signal) {
			let response;
			try {
				response = await fetchImpl(RESTART_URL, {
					method: "GET",
					cache: "no-store",
					signal
				});
			} catch (error) {
				if (signal?.aborted) throw error;
				throw new RestartProbeUnavailableError("identity probe unavailable", { cause: error });
			}
			if (!response.ok) throw new RestartProbeUnavailableError(`identity probe failed: HTTP ${response.status}`);
			return parseRestartIdentity(await response.json());
		}
		async function frontendReady(fetchImpl, signal) {
			let response;
			try {
				response = await fetchImpl("/", {
					method: "GET",
					cache: "no-store",
					signal
				});
			} catch (error) {
				if (signal?.aborted) throw error;
				throw new RestartProbeUnavailableError("frontend probe unavailable", { cause: error });
			}
			if (response.status === 401 || response.status === 403) throw new Error(`restart recovery unauthorized: HTTP ${response.status}`);
			return response.ok;
		}
		function identityChanged(before, after) {
			return before.pid !== after.pid || before.startedAt !== after.startedAt;
		}
		/** Restart DSH and wait until the process identity changes. */
		async function restartAndWait(options = {}) {
			const fetchImpl = options.fetchImpl ?? fetch;
			const isVisible = options.isVisible ?? (() => document.visibilityState === "visible");
			const maxRecoveryProbes = options.maxRecoveryProbes ?? 120;
			const maxVisibleStableProbes = options.maxVisibleStableProbes ?? 90;
			const pollIntervalMs = options.pollIntervalMs ?? 1e3;
			const sleep = options.sleep ?? defaultSleep;
			const { signal } = options;
			const baseline = await fetchRestartIdentity(fetchImpl, signal);
			const response = await fetchImpl(RESTART_URL, {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: "{}",
				signal
			});
			if (!response.ok) throw new Error(`restart request failed: HTTP ${response.status}`);
			let visibleStableProbes = 0;
			let recoveryProbes = 0;
			while (visibleStableProbes < maxVisibleStableProbes) {
				await sleep(pollIntervalMs, signal);
				let current;
				try {
					current = await fetchRestartIdentity(fetchImpl, signal);
				} catch (error) {
					if (!(error instanceof RestartProbeUnavailableError)) throw error;
					continue;
				}
				if (identityChanged(baseline, current)) {
					recoveryProbes += 1;
					try {
						if (await frontendReady(fetchImpl, signal)) return "restarted";
					} catch (error) {
						if (!(error instanceof RestartProbeUnavailableError)) throw error;
					}
					if (recoveryProbes >= maxRecoveryProbes) throw new Error("restarted process did not serve the authenticated frontend");
					continue;
				}
				if (isVisible()) visibleStableProbes += 1;
			}
			return "stale";
		}
		//#endregion
		//#region src/client/styles.ts
		/** Stable local class names; the plugin ships as one self-contained client.js. */
		const styles = {
			card: "dsh-restart-card",
			cardOpen: "dsh-restart-card-open",
			header: "dsh-restart-header",
			headText: "dsh-restart-head-text",
			name: "dsh-restart-name",
			description: "dsh-restart-description",
			chevron: "dsh-restart-chevron",
			chevronOpen: "dsh-restart-chevron-open",
			body: "dsh-restart-body",
			readOnly: "dsh-restart-read-only",
			field: "dsh-restart-field",
			toggleField: "dsh-restart-toggle-field",
			toggleCopy: "dsh-restart-toggle-copy",
			label: "dsh-restart-label",
			hint: "dsh-restart-hint",
			checkbox: "dsh-restart-checkbox",
			input: "dsh-restart-input",
			footer: "dsh-restart-footer",
			actionHint: "dsh-restart-action-hint",
			failed: "dsh-restart-failed",
			restart: "dsh-restart-button",
			sidebarButton: "dsh-restart-sidebar-button",
			sidebarButtonWide: "dsh-restart-sidebar-button-wide",
			sidebarButtonBusy: "dsh-restart-sidebar-button-busy",
			sidebarButtonFailed: "dsh-restart-sidebar-button-failed",
			sidebarSpin: "dsh-restart-sidebar-spin",
			sidebarText: "dsh-restart-sidebar-text"
		};
		const STYLE_ID = "dsh-restart-settings-card-styles";
		/** Install card styles once without creating a second dynamically loaded asset. */
		function ensureStyles() {
			if (document.getElementById(STYLE_ID) !== null) return;
			const style = document.createElement("style");
			style.id = STYLE_ID;
			style.textContent = `
.dsh-restart-card{list-style:none;border:1px solid var(--dsw-alias-border-l2);border-radius:12px;background:var(--dsw-alias-bg-layer-3);transition:border-color .16s,background .16s}
.dsh-restart-card:hover{border-color:var(--dsw-alias-label-dimmed)}
.dsh-restart-card-open{background:var(--dsw-alias-bg-layer-2);border-color:var(--dsw-alias-label-dimmed)}
.dsh-restart-header{width:100%;appearance:none;border:0;background:none;font:inherit;color:inherit;text-align:left;cursor:pointer;display:flex;align-items:center;gap:12px;padding:14px 16px;border-radius:12px}
.dsh-restart-header:focus-visible,.dsh-restart-button:focus-visible,.dsh-restart-checkbox:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}
.dsh-restart-head-text{flex:1;min-width:0;display:flex;flex-direction:column;gap:4px}
.dsh-restart-name{font-size:15px;font-weight:600;line-height:1.4;color:var(--dsw-alias-label-primary)}
.dsh-restart-description{font-size:13px;line-height:1.5;color:var(--dsw-alias-label-tertiary)}
.dsh-restart-chevron{flex:none;color:var(--dsw-alias-label-tertiary);transition:transform .16s}
.dsh-restart-chevron-open{transform:rotate(180deg)}
.dsh-restart-body{border-top:1px solid var(--dsw-alias-border-l2);margin:0 16px;padding-bottom:8px}
.dsh-restart-read-only{margin:12px 0 0;font-size:12px;line-height:1.5;color:var(--dsw-alias-label-tertiary)}
.dsh-restart-field,.dsh-restart-toggle-field{display:flex;gap:6px;padding:12px 0}
.dsh-restart-field{flex-direction:column}.dsh-restart-toggle-field{align-items:flex-start;cursor:pointer}
.dsh-restart-field+.dsh-restart-field,.dsh-restart-field+.dsh-restart-toggle-field,.dsh-restart-toggle-field+.dsh-restart-field,.dsh-restart-toggle-field+.dsh-restart-toggle-field{border-top:1px solid var(--dsw-alias-border-l2)}
.dsh-restart-toggle-copy{flex:1;min-width:0;display:flex;flex-direction:column;gap:4px}
.dsh-restart-label{font-size:13px;font-weight:500;line-height:1.5;color:var(--dsw-alias-label-primary)}
.dsh-restart-hint{margin:0;font-size:12px;line-height:1.5;color:var(--dsw-alias-label-tertiary)}
.dsh-restart-checkbox{width:16px;height:16px;margin:2px 2px 0 0;accent-color:var(--dsw-alias-brand-primary)}
.dsh-restart-checkbox:disabled{cursor:default;opacity:.5}
.dsh-restart-input{height:34px;padding:0 12px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-bg-layer-3);font:inherit;font-size:13px;line-height:1.5;color:var(--dsw-alias-label-primary)}
.dsh-restart-input:focus-visible{outline:none;border-color:var(--dsw-alias-brand-primary)}
.dsh-restart-input:disabled{color:var(--dsw-alias-label-tertiary);cursor:default}
.dsh-restart-footer{display:flex;align-items:center;justify-content:flex-end;gap:12px;padding:12px 0 4px;border-top:1px solid var(--dsw-alias-border-l2)}
.dsh-restart-action-hint,.dsh-restart-failed{flex:1;min-width:0;margin:0;font-size:12px;line-height:1.5}
.dsh-restart-action-hint{color:var(--dsw-alias-label-tertiary)}.dsh-restart-failed{color:var(--dsw-alias-label-error)}
.dsh-restart-button{appearance:none;border:1px solid transparent;border-radius:8px;padding:5px 14px;font:inherit;font-size:13px;line-height:1.5;cursor:pointer;background:var(--dsw-alias-label-primary);color:var(--dsw-alias-bg-layer-3)}
.dsh-restart-button:disabled{opacity:.4;cursor:default}
@media(max-width:480px){.dsh-restart-footer{align-items:stretch;flex-direction:column}.dsh-restart-button{width:100%}}
.dsh-restart-sidebar-button{appearance:none;border:0;background:none;font:inherit;color:var(--dsw-alias-label-secondary);cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;width:36px;height:36px;margin:0 auto;border-radius:50%;padding:0;font-size:17px;line-height:1;transition:background .16s,color .16s}
.dsh-restart-sidebar-button:hover{background:var(--dsw-alias-bg-layer-4);color:var(--dsw-alias-label-primary)}
.dsh-restart-sidebar-button:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}
.dsh-restart-sidebar-button:disabled{opacity:.5;cursor:default}
.dsh-restart-sidebar-button-wide{width:auto;height:32px;margin:0;border-radius:8px;padding:0 10px;justify-content:flex-start;font-size:13px}
.dsh-restart-sidebar-button-failed{color:var(--dsw-alias-state-error-primary)}
.dsh-restart-sidebar-text{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
@keyframes dsh-restart-sidebar-turn{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
.dsh-restart-sidebar-spin{display:inline-block;animation:dsh-restart-sidebar-turn 1s linear infinite}
`;
			document.head.append(style);
		}
		//#endregion
		//#region src/client/SettingsCard.tsx
		const RESTART_SUCCEEDED_KEY = "dsh-restart:completed";
		function consumeRestartSucceeded() {
			try {
				const succeeded = sessionStorage.getItem(RESTART_SUCCEEDED_KEY) === "1";
				if (succeeded) sessionStorage.removeItem(RESTART_SUCCEEDED_KEY);
				return succeeded;
			} catch {
				return false;
			}
		}
		function rememberRestartSucceeded() {
			try {
				sessionStorage.setItem(RESTART_SUCCEEDED_KEY, "1");
			} catch {}
		}
		/** The dsh-restart configuration card, styled with the host plugin-card tokens. */
		function SettingsCard(props) {
			const { t, set, clear } = props;
			const state = props.useDshRestart((snapshot) => snapshot);
			const [open, setOpen] = (0, react.useState)(false);
			const [restarting, setRestarting] = (0, react.useState)(false);
			const [restartFailed, setRestartFailed] = (0, react.useState)(false);
			const [restartStale, setRestartStale] = (0, react.useState)(false);
			const [restartSucceeded, setRestartSucceeded] = (0, react.useState)(consumeRestartSucceeded);
			const restartController = (0, react.useRef)(null);
			(0, react.useEffect)(() => () => {
				restartController.current?.abort();
			}, []);
			(0, react.useEffect)(() => {
				if (!restartSucceeded) return;
				const timer = window.setTimeout(() => {
					setRestartSucceeded(false);
				}, 5e3);
				return () => {
					window.clearTimeout(timer);
				};
			}, [restartSucceeded]);
			if (!state.available) return null;
			const disabled = !state.writable;
			const text = (field, value) => {
				if (value.trim() === "") clear(field);
				else set(field, value.trim());
			};
			const restartNow = async () => {
				if (restarting) return;
				setRestarting(true);
				setRestartFailed(false);
				setRestartStale(false);
				setRestartSucceeded(false);
				const controller = new AbortController();
				restartController.current = controller;
				try {
					if (await restartAndWait({
						signal: controller.signal,
						isVisible: () => document.visibilityState === "visible"
					}) === "stale") {
						setRestartStale(true);
						setRestarting(false);
						return;
					}
					rememberRestartSucceeded();
					window.location.reload();
				} catch {
					if (controller.signal.aborted) return;
					setRestartFailed(true);
					setRestarting(false);
				} finally {
					if (restartController.current === controller) restartController.current = null;
				}
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: `${styles.card} ${open ? styles.cardOpen : ""}`,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
					type: "button",
					className: styles.header,
					"aria-expanded": open,
					"aria-label": `${t(open ? "collapse" : "expand")}: ${t("title")}`,
					onClick: () => {
						setOpen(!open);
					},
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
						className: styles.headText,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: styles.name,
							children: t("title")
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: styles.description,
							children: t("description")
						})]
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
						className: `${styles.chevron} ${open ? styles.chevronOpen : ""}`,
						viewBox: "0 0 14 14",
						width: "14",
						height: "14",
						"aria-hidden": "true",
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
							d: "M3.5 5.5 7 9l3.5-3.5",
							fill: "none",
							stroke: "currentColor",
							strokeWidth: "1.5",
							strokeLinecap: "round",
							strokeLinejoin: "round"
						})
					})]
				}), open ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: styles.body,
					children: [
						!state.writable ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: styles.readOnly,
							role: "status",
							children: t("readOnly")
						}) : null,
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
							className: styles.toggleField,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
								className: styles.checkbox,
								type: "checkbox",
								checked: state.legacyRestart,
								disabled,
								onChange: (event) => {
									set("legacyRestart", event.currentTarget.checked);
								}
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
								className: styles.toggleCopy,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: styles.label,
									children: t("legacyRestart")
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: styles.hint,
									children: t("legacyRestartHint")
								})]
							})]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
							className: styles.field,
							htmlFor: "dsh-restart-continue-prompt",
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: styles.label,
									children: t("continuePrompt")
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
									id: "dsh-restart-continue-prompt",
									className: styles.input,
									type: "text",
									value: state.continuePrompt,
									disabled,
									onChange: (event) => {
										text("continuePrompt", event.currentTarget.value);
									}
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: styles.hint,
									children: t("continuePromptHint")
								})
							]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: styles.footer,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: restartFailed || restartStale ? styles.failed : styles.actionHint,
								role: "status",
								"aria-live": "polite",
								children: restartStale ? t("restartStale") : restartFailed ? t("restartFailed") : restartSucceeded ? t("restartSucceeded") : t("restartHint")
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: styles.restart,
								disabled: restarting,
								onClick: () => {
									restartNow();
								},
								children: t(restarting ? "restarting" : "restartNow")
							})]
						})
					]
				}) : null]
			});
		}
		//#endregion
		//#region src/client/SidebarRestartButton.tsx
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
		/** How long a failed attempt stays visible before the button returns to idle. */
		const RESET_MS = 8e3;
		/** Restart the Host, reloading the page once the new process answers. */
		function SidebarRestartButton({ wide, t }) {
			ensureStyles();
			const [phase, setPhase] = (0, react.useState)("idle");
			const [detail, setDetail] = (0, react.useState)("");
			const resetTimer = (0, react.useRef)(null);
			const controller = (0, react.useRef)(null);
			(0, react.useEffect)(() => () => {
				if (resetTimer.current !== null) window.clearTimeout(resetTimer.current);
				controller.current?.abort();
			}, []);
			const onClick = () => {
				if (phase === "busy") return;
				setPhase("busy");
				setDetail("");
				const aborter = new AbortController();
				controller.current = aborter;
				const fail = (reason) => {
					if (aborter.signal.aborted) return;
					setPhase("failed");
					setDetail(reason);
					if (resetTimer.current !== null) window.clearTimeout(resetTimer.current);
					resetTimer.current = window.setTimeout(() => {
						resetTimer.current = null;
						setPhase("idle");
					}, RESET_MS);
				};
				restartAndWait({
					signal: aborter.signal,
					isVisible: () => document.visibilityState === "visible"
				}).then((outcome) => {
					if (outcome === "restarted") {
						window.location.reload();
						return;
					}
					fail(t("restartStale"));
				}).catch((error) => {
					fail(error instanceof Error ? error.message : String(error));
				});
			};
			const busy = phase === "busy";
			const failed = phase === "failed";
			const label = busy ? t("sidebarRestarting") : failed ? t("sidebarFailed") : t("sidebarTitle");
			const className = [
				styles.sidebarButton,
				wide ? styles.sidebarButtonWide : "",
				busy ? styles.sidebarButtonBusy : "",
				failed ? styles.sidebarButtonFailed : ""
			].filter(Boolean).join(" ");
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
				type: "button",
				className,
				"aria-label": label,
				title: failed && detail !== "" ? label + ": " + detail : label,
				disabled: busy,
				onClick,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					"aria-hidden": "true",
					className: busy ? styles.sidebarSpin : void 0,
					children: "↻"
				}), wide ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: styles.sidebarText,
					children: label
				}) : null]
			});
		}
		//#endregion
		//#region src/client/locales.ts
		const zh = {
			title: "DSH 重启",
			description: "重启方式与自动继续提示词（写入 settings.yaml，host 读取）",
			legacyRestart: "旧重启方式",
			legacyRestartHint: "true = 用 PowerShell/WMI/taskkill 旧方式重启（适配）；false = Node 原生重启",
			continuePrompt: "重启后注入的提示词",
			continuePromptHint: "重启后自动继续时注入给 agent 的文本（空则用默认）",
			expand: "展开",
			collapse: "收起",
			readOnly: "当前配置为只读",
			restartNow: "立即重启",
			restarting: "正在重启…",
			restartHint: "配置修改会自动保存；立即重启会短暂断开当前页面。",
			restartFailed: "未能安排重启，请检查服务日志后重试。",
			restartStale: "已发送重启请求，但进程身份始终未变化。请检查服务日志。",
			restartSucceeded: "DSH 已重启并恢复连接。",
			sidebarTitle: "重启 DSH 后端",
			sidebarRestarting: "正在重启…",
			sidebarFailed: "重启请求失败，点击重试"
		};
		const en = {
			title: "DSH Restart",
			description: "Restart method and auto-continue prompt (stored in settings.yaml)",
			legacyRestart: "Legacy restart",
			legacyRestartHint: "true = old PowerShell/WMI/taskkill restart; false = Node-native restart",
			continuePrompt: "Continue prompt",
			continuePromptHint: "Text injected to the agent after restart (empty = default)",
			expand: "Expand",
			collapse: "Collapse",
			readOnly: "This configuration is read-only",
			restartNow: "Restart now",
			restarting: "Restarting…",
			restartHint: "Configuration changes save automatically; restarting briefly disconnects this page.",
			restartFailed: "Could not schedule the restart. Check the service logs and try again.",
			restartStale: "The restart was requested, but the process identity never changed. Check the service logs.",
			restartSucceeded: "DSH restarted and reconnected.",
			sidebarTitle: "Restart DSH backend",
			sidebarRestarting: "Restarting…",
			sidebarFailed: "Restart request failed, click to retry"
		};
		//#endregion
		//#region src/client/index.ts
		const name = "dsh-restart-client";
		const inject = [
			"slots",
			"locale",
			"settingsScope"
		];
		const NS = "restart.card";
		function apply(ctx) {
			ensureStyles();
			ctx.effect(() => ctx.locale.register(NS, {
				zh,
				en
			}), "dsh-restart: dictionaries");
			const scope = ctx.settingsScope.bind({ namespace: "dsh-restart" });
			const t = ctx.locale.bind(NS);
			const project = () => {
				const snap = scope.getSnapshot();
				const value = snap.value ?? {};
				return {
					available: snap.status === "ready",
					writable: snap.writable,
					legacyRestart: value.legacyRestart === true,
					continuePrompt: typeof value.continuePrompt === "string" ? value.continuePrompt : ""
				};
			};
			const store = (0, _deepseek_ai_dsh_client_store.createSnapshotStore)(project());
			scope.subscribe(() => {
				store.set(project());
			});
			ctx.slots.inject("settings.plugins.tab", () => ctx.slots.register({
				name: "settings.plugins.tab",
				id: "dsh-restart",
				order: 10,
				label: () => t("title"),
				locale: NS,
				inject: () => ({
					hooks: { dshRestart: store },
					set: (field, value) => {
						scope.set(field, value);
					},
					clear: (field) => {
						scope.unset(field);
					}
				})
			}, SettingsCard));
			ctx.slots.inject("sidebar.footer.action", () => ctx.slots.register({
				name: "sidebar.footer.action",
				id: "dsh-restart",
				order: 30,
				locale: NS
			}, SidebarRestartButton));
		}
		//#endregion
		exports.NS = NS;
		exports.apply = apply;
		exports.inject = inject;
		exports.name = name;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map
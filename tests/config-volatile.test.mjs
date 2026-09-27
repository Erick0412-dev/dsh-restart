/**
 * Regression: DSH 0.1.7 serves a plugin's settings form only for the fields it
 * marks volatile.
 *
 * \`volatileForm\` (@deepseek-ai/dsh-settings) rebuilds the form from the fields
 * whose nearest schema ancestor carries the \`.volatile()\` mark, and
 * \`SettingsForms.describe()\` drops an entry whose form is undefined. A Config
 * schema that marks no field therefore leaves the settings page with no
 * writable namespace and every control disabled. See \`volatileField\` in
 * src/index.ts.
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import { Config } from '../lib/index.js'

/** The fields the settings page edits: all of them must be served. */
const SERVED = ['legacyRestart', 'continuePrompt', 'quickRestartSidebar', 'quickRestartHeader']

/** Deprecated fields kept readable in settings.yaml but never shown. */
const HIDDEN = ['watchdogEnabled', 'watchdogCooldownMs', 'watchdogPollMs']

test('the Config schema marks every settings-page field volatile', () => {
  for (const field of SERVED) {
    const meta = Config.dict?.[field]?.meta ?? {}
    assert.equal(meta.volatile, true, field + ' must carry the volatile mark')
  }
  for (const field of HIDDEN) {
    const meta = Config.dict?.[field]?.meta ?? {}
    assert.notEqual(meta.volatile, true, field + ' must stay out of the served form')
  }
})

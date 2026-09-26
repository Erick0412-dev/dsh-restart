import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import test from 'node:test'

const require = createRequire(import.meta.url)
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')

/**
 * Evaluate the shipped client bundle exactly as the Web runtime does: the
 * bundle registers a factory with __ModuleLoader__, and the loader hands it a
 * require() resolved against the client module graph.
 */
let registered
function loadClientBundle() {
  if (registered === undefined) {
    globalThis.window = { __ModuleLoader__: { load(value) { registered = value } } }
    globalThis.document = {
      getElementById() { return null },
      createElement() { return { id: '', textContent: '' } },
      head: { append() {} },
    }
    require('../lib/client.js')
  }
  const definition = registered
  assert.ok(definition, 'the bundle must register itself with __ModuleLoader__')
  assert.equal(definition.id, 'dsh-restart')

  const store = {
    createSnapshotStore(initial) {
      let current = initial
      return {
        getSnapshot() { return current },
        subscribe() { return () => {} },
        set(next) { current = next },
      }
    },
  }
  const exports = definition.factory(specifier => {
    if (specifier === '@deepseek-ai/dsh-client-store') return store
    return require(specifier)
  })
  return exports
}

/** Minimal client ctx: records what the plugin asks for and registers. */
function fakeCtx() {
  const injected = []
  const registered = []
  const ctx = {
    effect(callback) { return callback() },
    locale: {
      register() {},
      bind() { return (key) => 't:' + key },
    },
    settingsScope: {
      bind() {
        return {
          getSnapshot() {
            return { status: 'ready', writable: true, value: { legacyRestart: false, continuePrompt: '' } }
          },
          subscribe() { return () => {} },
          set() { return Promise.resolve() },
          unset() { return Promise.resolve() },
        }
      },
    },
    slots: {
      inject(key, callback) { injected.push(key); return callback() },
      register(options, component) { registered.push({ options, component }); return () => {} },
    },
  }
  return { ctx, injected, registered }
}

test('the client half contributes a Plugins tab and a sidebar footer action', () => {
  const bundle = loadClientBundle()
  const { ctx, injected, registered } = fakeCtx()

  bundle.apply(ctx)

  assert.deepEqual(injected, ['settings.plugins.tab', 'sidebar.footer.action'])

  const tab = registered.find(entry => entry.options.name === 'settings.plugins.tab')
  assert.ok(tab, 'the settings tab must be registered')
  assert.equal(tab.options.id, 'dsh-restart')
  assert.equal(tab.options.locale, 'restart.card')
  // The section reads the strip label through resolveSlotLabel, so a thunk
  // keeps it following the active locale instead of freezing at load time.
  assert.equal(typeof tab.options.label, 'function')
  assert.equal(tab.options.label(), 't:title')
  assert.equal(typeof tab.options.inject().hooks.dshRestart, 'object')

  const action = registered.find(entry => entry.options.name === 'sidebar.footer.action')
  assert.ok(action, 'the sidebar action must be registered')
  assert.equal(action.options.id, 'dsh-restart')
  assert.equal(action.options.locale, 'restart.card')
  // No connection/RPC dependency: the button drives the Web route through the
  // same trust fence the rest of the app uses.
  assert.equal(action.options.inject, undefined)
})

test('the sidebar action renders a rail icon and a labelled wide button', () => {
  const bundle = loadClientBundle()
  const { ctx, registered } = fakeCtx()
  bundle.apply(ctx)
  const action = registered.find(entry => entry.options.name === 'sidebar.footer.action')

  const rail = renderToStaticMarkup(React.createElement(action.component, { wide: false, t: key => key }))
  assert.match(rail, /<button/)
  assert.match(rail, /aria-label="sidebarTitle"/)
  assert.match(rail, /dsh-restart-sidebar-button/)
  assert.ok(!rail.includes('dsh-restart-sidebar-button-wide'))
  assert.ok(rail.includes('\u21BB'), 'the rail form shows only the icon')

  const wide = renderToStaticMarkup(React.createElement(action.component, { wide: true, t: key => key }))
  assert.match(wide, /dsh-restart-sidebar-button-wide/)
  assert.match(wide, /dsh-restart-sidebar-text/)
  assert.match(wide, />sidebarTitle</)
})

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

import { apply } from '../lib/index.js'

const wait = delayMs => new Promise(resolve => setTimeout(resolve, delayMs))

test('auto-continue keeps the recovery marker when followup throws', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-restart-auto-continue-'))
  const marker = path.join(root, 'dsh-resume.json')
  const previousHome = process.env.DSH_HOME
  const cleanups = []
  const originalConsoleError = console.error

  process.env.DSH_HOME = root
  fs.writeFileSync(marker, JSON.stringify({ sessionIds: ['session-1'] }), 'utf8')
  console.error = () => {}

  const config = {
    legacyRestart: false,
    continuePrompt: 'continue',
    watchdogEnabled: false,
    watchdogCooldownMs: 60_000,
    watchdogPollMs: 1_000,
  }
  const ctx = {
    agents: {
      get(sessionId) {
        if (sessionId !== 'session-1') return undefined
        return { followup() { throw new Error('queue unavailable') } }
      },
    },
    commands: { register() {} },
    effect(register) {
      const cleanup = register()
      if (typeof cleanup === 'function') cleanups.push(cleanup)
    },
    inject(dependencies, callback) {
      if (!dependencies.includes('settings')) return
      callback({
        settings: {
          installSection(_ctx, _name, _schema, _defaults, options) {
            options.setSource(() => config)
          },
        },
      })
    },
    sandboxPolicy: { resolve() { return undefined } },
    shell: {},
    tools: { register() {} },
  }

  try {
    apply(ctx)
    await wait(650)
    assert.equal(fs.existsSync(marker), true)
  } finally {
    for (const cleanup of cleanups) cleanup()
    console.error = originalConsoleError
    if (previousHome === undefined) delete process.env.DSH_HOME
    else process.env.DSH_HOME = previousHome
    fs.rmSync(root, { recursive: true, force: true })
  }
})

test('auto-continue resumes a cold session through the Session API', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-restart-auto-resume-'))
  const marker = path.join(root, 'dsh-resume.json')
  const previousHome = process.env.DSH_HOME
  const cleanups = []
  const delivered = []
  const resumed = []

  process.env.DSH_HOME = root
  fs.writeFileSync(marker, JSON.stringify({ sessionIds: ['session-cold'] }), 'utf8')

  const config = {
    legacyRestart: false,
    continuePrompt: 'keep going',
    watchdogEnabled: false,
    watchdogCooldownMs: 60_000,
    watchdogPollMs: 1_000,
  }
  const ctx = {
    agents: { get() { return undefined } },
    commands: { register() {} },
    effect(register) {
      const cleanup = register()
      if (typeof cleanup === 'function') cleanups.push(cleanup)
    },
    inject(dependencies, callback) {
      if (dependencies.includes('settings')) {
        callback({ settings: { installSection(_ctx, _name, _schema, _defaults, options) { options.setSource(() => config) } } })
        return
      }
      if (dependencies.includes('sessionController')) {
        callback({ sessionController: { async resolveAgent(sessionId) { resumed.push(sessionId); return { agent: { followup(message) { delivered.push(message) } } } } } })
      }
    },
    sandboxPolicy: { resolve() { return undefined } },
    shell: {},
    tools: { register() {} },
  }

  try {
    apply(ctx)
    // One tick resolves the cold session, the next one sees the empty queue.
    await wait(1300)
    assert.deepEqual(resumed, ['session-cold'])
    assert.equal(delivered.length, 1)
    assert.match(JSON.stringify(delivered[0]), /keep going/)
    assert.equal(fs.existsSync(marker), false)
  } finally {
    for (const cleanup of cleanups) cleanup()
    if (previousHome === undefined) delete process.env.DSH_HOME
    else process.env.DSH_HOME = previousHome
    fs.rmSync(root, { recursive: true, force: true })
  }
})

test('auto-continue safely unwraps volatile config getters without DataCloneError', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-restart-auto-volatile-'))
  const marker = path.join(root, 'dsh-resume.json')
  const previousHome = process.env.DSH_HOME
  const cleanups = []
  const delivered = []

  process.env.DSH_HOME = root
  fs.writeFileSync(marker, JSON.stringify({ sessionIds: ['session-volatile'] }), 'utf8')

  // Simulate Cosmokit Volatile wrappers produced by DSH 0.1.7 settings
  const volatileConfig = {
    legacyRestart: { get: () => false },
    continuePrompt: { get: () => 'resume work safely after restart' },
    quickRestartSidebar: { get: () => true },
    quickRestartHeader: { get: () => true },
    watchdogEnabled: false,
    watchdogCooldownMs: 60_000,
    watchdogPollMs: 1_000,
  }

  const ctx = {
    agents: {
      get(sessionId) {
        if (sessionId !== 'session-volatile') return undefined
        return {
          followup(message) {
            // Emulate DSH createMessage -> deepFreeze(structuredClone(input))
            const cloned = structuredClone(message)
            delivered.push(cloned)
          },
        }
      },
    },
    commands: { register() {} },
    effect(register) {
      const cleanup = register()
      if (typeof cleanup === 'function') cleanups.push(cleanup)
    },
    inject(dependencies, callback) {
      if (dependencies.includes('settings')) {
        callback({
          settings: {
            installSection(_ctx, _name, _schema, _defaults, options) {
              options.setSource(() => volatileConfig)
            },
          },
        })
      }
    },
    sandboxPolicy: { resolve() { return undefined } },
    shell: {},
    tools: { register() {} },
  }

  try {
    apply(ctx, volatileConfig)
    await wait(700)
    assert.equal(delivered.length, 1)
    assert.equal(typeof delivered[0].content[0].text, 'string')
    assert.equal(delivered[0].content[0].text, 'resume work safely after restart')
    assert.equal(fs.existsSync(marker), false)
  } finally {
    for (const cleanup of cleanups) cleanup()
    if (previousHome === undefined) delete process.env.DSH_HOME
    else process.env.DSH_HOME = previousHome
    fs.rmSync(root, { recursive: true, force: true })
  }
})

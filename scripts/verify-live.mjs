import assert from 'node:assert/strict'
import path from 'node:path'
import { createRequire } from 'node:module'

const target = new URL(process.env.DSH_VERIFY_URL ?? '')
assert.ok(['127.0.0.1', 'localhost'].includes(target.hostname), 'DSH_VERIFY_URL must use loopback')

const harnessRoot = process.env.DSH_HARNESS_ROOT
assert.ok(harnessRoot, 'DSH_HARNESS_ROOT is required')
const require = createRequire(path.join(harnessRoot, 'apps', 'web', 'package.json'))
const { chromium } = require('playwright')

const screenshotPath = process.env.DSH_VERIFY_SCREENSHOT
// Chrome is only the transport for this check: DSH_VERIFY_CHROME wins so a host
// can point at a nightly channel or a container path, and the platform default
// keeps the script usable on Linux, macOS and Windows alike.
const DEFAULT_CHROME_PATH = process.platform === 'win32'
  ? 'C:/Program Files/Google/Chrome/Application/chrome.exe'
  : process.platform === 'darwin'
    ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
    : '/usr/bin/google-chrome'
const browser = await chromium.launch({
  executablePath: process.env.DSH_VERIFY_CHROME ?? DEFAULT_CHROME_PATH,
  headless: true,
})
const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, locale: 'zh-CN' })
const page = await context.newPage()
const consoleProblems = []
const pageErrors = []
page.on('console', message => {
  if (message.type() === 'error' || message.type() === 'warning') {
    const location = message.location()
    const suffix = location.url ? ` (${location.url}:${location.lineNumber ?? 0})` : ''
    consoleProblems.push(`${message.type()}: ${message.text()}${suffix}`)
  }
})
page.on('pageerror', error => { pageErrors.push(String(error)) })

async function restartIdentity() {
  return await page.evaluate(async () => {
    const response = await fetch('/plugins/dsh-restart/restart', { cache: 'no-store' })
    if (!response.ok) throw new Error(`restart identity HTTP ${response.status}`)
    return await response.json()
  })
}

async function clickFirst(candidates) {
  for (const candidate of candidates) {
    try {
      await candidate.first().waitFor({ timeout: 10_000 })
      await candidate.first().click()
      return
    } catch {
      // Try the next role/text form for this known DSH control.
    }
  }
  throw new Error('expected navigation control was not found')
}

try {
  try {
    await page.goto(target.href, { waitUntil: 'domcontentloaded', timeout: 60_000 })
  } catch (error) {
    throw new Error(`failed to open ${target.origin}: ${error instanceof Error ? error.name : String(error)}`)
  }
  // A fresh isolated profile may show the first-run notice above the shell.
  // Escape only dismisses that transient dialog; it does not alter DSH data.
  await page.keyboard.press('Escape')
  await page.waitForTimeout(250)
  for (const label of ['继续', '稍后配置']) {
    const onboardingAction = page.getByRole('button', { name: label, exact: true })
    try {
      await onboardingAction.waitFor({ timeout: 5_000 })
      await onboardingAction.click()
    } catch {
      // Existing profiles may have completed this onboarding step already.
    }
  }
  if (process.env.DSH_VERIFY_DEBUG_SCREENSHOT) {
    await page.screenshot({ path: process.env.DSH_VERIFY_DEBUG_SCREENSHOT })
    console.log(JSON.stringify({ dialogs: await page.locator('[role="dialog"]').allInnerTexts() }))
  }
  // The sidebar action lives in the shell, so assert it before the settings
  // dialog makes the rest of the page inert.
  const sidebarRestart = page.getByRole('button', { name: '重启 DSH 后端', exact: true })
  await sidebarRestart.waitFor({ timeout: 20_000 })
  assert.match(String(await sidebarRestart.getAttribute('title')), /重启 DSH 后端/)
  await clickFirst([
    page.getByRole('button', { name: '设置', exact: true }),
    page.getByText('设置', { exact: true }),
  ])
  const settingsDialog = page.getByRole('dialog')
  await settingsDialog.waitFor({ timeout: 20_000 })
  await clickFirst([
    settingsDialog.getByRole('button', { name: '插件', exact: true }),
    settingsDialog.getByText('插件', { exact: true }),
  ])
  // DSH 0.1.7 renders configurable plugins as tabs of the 插件 section
  // (slot settings.plugins.tab); the 0.1.5-era 「插件配置」 card list is gone.
  const restartTab = settingsDialog.getByRole('tab', { name: 'DSH 重启', exact: true })
  await restartTab.waitFor({ timeout: 20_000 })
  await restartTab.click()

  const settingsText = await page.locator('body').innerText()
  assert.match(settingsText, /重启后注入的提示词/)
  assert.doesNotMatch(settingsText, /看门狗|watchdog/i)
  if (screenshotPath) await page.screenshot({ path: screenshotPath })

  const before = await restartIdentity()
  await page.getByRole('button', { name: '立即重启', exact: true }).click()
  const deadline = Date.now() + 120_000
  let after
  while (Date.now() < deadline) {
    await page.waitForTimeout(500)
    try {
      const candidate = await restartIdentity()
      if (candidate.pid !== before.pid || candidate.startedAt !== before.startedAt) {
        after = candidate
        break
      }
    } catch {
      // A refused request is expected while the old process releases the port.
    }
  }
  assert.ok(after, 'DSH process identity did not change within 120 seconds')
  const expectedRestartTransportProblems = consoleProblems.length
  // The settings card reloads the page itself once it observes the new PID.
  const recoveryDeadline = Date.now() + 30_000
  let recovered
  while (Date.now() < recoveryDeadline) {
    await page.waitForTimeout(500)
    try {
      const candidate = await restartIdentity()
      if (candidate.pid === after.pid) {
        recovered = candidate
        break
      }
    } catch {
      // Navigation and transport reconnection can overlap briefly.
    }
  }
  if (!recovered && process.env.DSH_VERIFY_DEBUG_SCREENSHOT) {
    await page.screenshot({ path: process.env.DSH_VERIFY_DEBUG_SCREENSHOT }).catch(() => {})
    const current = new URL(page.url())
    console.log(JSON.stringify({
      recoveryFailure: true,
      page: `${current.origin}${current.pathname}`,
      body: (await page.locator('body').innerText().catch(() => '')).slice(0, 500),
    }))
  }
  assert.ok(recovered, 'browser did not recover after the process identity changed')
  consoleProblems.length = 0
  pageErrors.length = 0
  await page.waitForTimeout(1_500)
  assert.equal((await restartIdentity()).pid, after.pid)
  assert.deepEqual(pageErrors, [])
  assert.deepEqual(consoleProblems, [])

  console.log(JSON.stringify({
    ok: true,
    origin: target.origin,
    beforePid: before.pid,
    afterPid: after.pid,
    expectedRestartTransportProblems,
    recoveredConsoleProblems: consoleProblems,
    screenshotPath,
  }))
} finally {
  await browser.close()
}

import { test, expect } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { openNewSheet } from './helpers.js'

const FIXTURE = join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'sample.csv')

// Strip BOM, trailing whitespace, and trailing empty lines so input/output
// can be compared cell-for-cell regardless of how the engine re-serializes
// (line endings, optional trailing newline, etc.).
function normalize(csv) {
  return csv
    .replace(/^﻿/, '')
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((l) => l.replace(/\s+$/, ''))
    .filter((l, i, a) => !(i === a.length - 1 && l === ''))
    .join('\n')
}

test.describe('CSV round-trip', () => {
  test('import → export reproduces the same rows', async ({ page }) => {
    await openNewSheet(page)

    await page.locator('input[name="csv-import"]').setInputFiles(FIXTURE)

    await expect(page.locator('.sn-save-status').filter({ hasText: /Sav/i }).first())
      .toBeVisible({ timeout: 15_000 })

    await page.getByRole('button', { name: 'File' }).click()

    const downloadPromise = page.waitForEvent('download', { timeout: 15_000 })
    await page.getByRole('menuitem', { name: /Export as CSV/i })
      .or(page.getByText(/Export as CSV/i))
      .first()
      .click()
    const download = await downloadPromise

    const exported = await readFile(await download.path(), 'utf8')
    const original = await readFile(FIXTURE, 'utf8')

    expect(normalize(exported)).toBe(normalize(original))
  })
})

import { request } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:8000'
const ADMIN_USER = process.env.FRAPPE_ADMIN_USER || 'Administrator'
const ADMIN_PASSWORD = process.env.FRAPPE_ADMIN_PASSWORD || 'admin'
const STORAGE_PATH = 'e2e/.auth/admin.json'

export default async function globalSetup() {
  const ctx = await request.newContext({ baseURL: BASE_URL })

  const res = await ctx.post('/api/method/login', {
    form: { usr: ADMIN_USER, pwd: ADMIN_PASSWORD },
  })

  if (!res.ok()) {
    throw new Error(
      `Frappe login failed (${res.status()}). Is the bench up at ${BASE_URL}? ` +
      `Set FRAPPE_ADMIN_USER / FRAPPE_ADMIN_PASSWORD if not using defaults.`,
    )
  }

  await mkdir(dirname(STORAGE_PATH), { recursive: true })
  await ctx.storageState({ path: STORAGE_PATH })
  await ctx.dispose()
}

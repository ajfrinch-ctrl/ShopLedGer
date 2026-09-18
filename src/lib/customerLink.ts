import { db, type DbCustomer } from './db'
import type { AuthUser } from '../stores/authStore'
import { nextCustomerId } from './idGenerator'

const normPhone = (p?: string) => (p || '').replace(/\D/g, '').replace(/^88/, '')

/**
 * ক্রেতা-রোলের ইউজারকে ক্রেতা তালিকার এন্ট্রির সাথে ফোন নম্বর মিলিয়ে যুক্ত করা।
 * না পেলে ইউজারের নাম/ফোন দিয়ে নতুন ক্রেতা তৈরি হয়।
 */
export async function linkCustomerForUser(user: AuthUser): Promise<DbCustomer> {
  const phone = normPhone(user.phone)
  const all = await db.customers.toArray()
  const found = phone ? all.find((c) => normPhone(c.phone) === phone) : undefined
  if (found) return found
  const cid = await nextCustomerId(new Date())
  const created: DbCustomer = {
    id: cid,
    name: user.name,
    phone: user.phone,
    branch_id: user.branch_id || 'branch-1',
    created_at: new Date().toISOString(),
  }
  const existing = await db.customers.get(created.id)
  if (existing) return existing
  await db.customers.add(created)
  return created
}

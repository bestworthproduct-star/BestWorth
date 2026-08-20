import type { AuthUser, PermissionLevel, PermissionModule } from '@/types/auth'

const rank: Record<PermissionLevel, number> = { none: 0, view: 1, manage: 2 }

export function canAccess(user: AuthUser | null, moduleName: PermissionModule, level: PermissionLevel = 'view') {
  if (!user) return false
  if (user.role === 'admin') return true
  return rank[user.permissions?.[moduleName] || 'none'] >= rank[level]
}

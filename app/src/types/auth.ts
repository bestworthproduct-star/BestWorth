export type Role = 'admin' | 'worker'
export type PermissionLevel = 'none' | 'view' | 'manage'
export type PermissionModule = 'overview' | 'catalog' | 'leadership' | 'inquiries' | 'media' | 'cms'

export type Permissions = Record<PermissionModule, PermissionLevel>

export interface AuthUser {
  id: string
  username: string
  fullName: string
  email: string
  role: Role
  permissions: Permissions
  active: boolean
  mustChangePassword: boolean
  lastLoginAt: string | null
  createdAt: string | null
  updatedAt: string | null
  notificationEmails?: string[]
  passwordChangeLocked?: boolean
}

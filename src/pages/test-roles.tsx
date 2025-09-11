import { useState } from 'react'
import { hasAdminAccess, canManageUsers, hasEditingRights, canSeeManagementPanels, canOnlySeeOwnWork, getAccessScopeDescription, getRoleDisplay } from '@/utils/roles'
import type { UserRole } from '@/types/supabase'

export default function TestRoles() {
  const [selectedRole, setSelectedRole] = useState<UserRole>('user')
  
  const testRoles: UserRole[] = ['user', 'manager', 'supervisor', 'admin']
  
  const testAccounts = [
    { email: 'john+1@tpnlife.com', expectedRole: 'user' as UserRole },
    { email: 'john+user@tpnlife.com', expectedRole: 'user' as UserRole },
    { email: 'john+2@tpnlife.com', expectedRole: 'manager' as UserRole },
    { email: 'john+m2@tpnlife.com', expectedRole: 'manager' as UserRole },
    { email: 'john+manager@tpnlife.com', expectedRole: 'manager' as UserRole },
    { email: 'john+3@tpnlife.com', expectedRole: 'supervisor' as UserRole },
    { email: 'john+s2@tpnlife.com', expectedRole: 'supervisor' as UserRole },
    { email: 'john+supervisor@tpnlife.com', expectedRole: 'supervisor' as UserRole },
    { email: 'john@tpnlife.com', expectedRole: 'admin' as UserRole },
    { email: 'john+admin@tpnlife.com', expectedRole: 'admin' as UserRole },
  ]

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold mb-8">Role Testing Dashboard</h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Role Selector */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Test Role Permissions</h2>
          <div className="space-y-4">
            {testRoles.map((role) => {
              const roleDisplay = getRoleDisplay(role)
              return (
                <button
                  key={role}
                  onClick={() => setSelectedRole(role)}
                  className={`w-full p-3 rounded-lg text-left transition-colors ${
                    selectedRole === role
                      ? 'bg-blue-100 border-2 border-blue-300 dark:bg-blue-900 dark:border-blue-700'
                      : 'bg-gray-50 border border-gray-200 hover:bg-gray-100 dark:bg-gray-700 dark:border-gray-600'
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    <span className="text-2xl">{roleDisplay.icon}</span>
                    <div>
                      <div className="font-medium">{roleDisplay.label}</div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        {getAccessScopeDescription(role)}
                      </div>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Permissions Display */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">
            Permissions for {getRoleDisplay(selectedRole).icon} {getRoleDisplay(selectedRole).label}
          </h2>
          <div className="space-y-3">
            <PermissionItem 
              label="Has Admin Access" 
              granted={hasAdminAccess(selectedRole)}
              description="Can access admin features"
            />
            <PermissionItem 
              label="Can See Management Panels" 
              granted={canSeeManagementPanels(selectedRole)}
              description="Videos, Hierarchy, Users buttons visible"
            />
            <PermissionItem 
              label="Can Manage Users" 
              granted={canManageUsers(selectedRole)}
              description="Can assign/reassign users"
            />
            <PermissionItem 
              label="Has Editing Rights" 
              granted={hasEditingRights(selectedRole)}
              description="Can edit/delete content"
            />
            <PermissionItem 
              label="Can Only See Own Work" 
              granted={canOnlySeeOwnWork(selectedRole)}
              description="Limited to own recordings"
            />
          </div>
        </div>
      </div>

      {/* Account Mapping */}
      <div className="mt-8 bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Account Role Mapping</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {testAccounts.map((account) => {
            const roleDisplay = getRoleDisplay(account.expectedRole)
            return (
              <div key={account.email} className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div className="font-medium text-sm">{account.email}</div>
                <div className="flex items-center space-x-2 mt-1">
                  <span>{roleDisplay.icon}</span>
                  <span className="text-sm font-medium">{roleDisplay.label}</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function PermissionItem({ label, granted, description }: { label: string, granted: boolean, description: string }) {
  return (
    <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
      <div>
        <div className="font-medium">{label}</div>
        <div className="text-sm text-gray-600 dark:text-gray-400">{description}</div>
      </div>
      <div className={`px-3 py-1 rounded-full text-sm font-medium ${
        granted 
          ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' 
          : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
      }`}>
        {granted ? '✅ Yes' : '❌ No'}
      </div>
    </div>
  )
}

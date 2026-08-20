import { useState } from 'react'
import { User, ShieldAlert, Eye, EyeOff, Save, Lock } from 'lucide-react'

interface AccountSettingsProps {
  settings: any
  onSave: (e: React.FormEvent) => void
  onUpdateSettings: (settings: any) => void
  saving: boolean
  passwordChangeLocked: boolean
  isAdmin: boolean
}

export default function AccountSettings({
  settings,
  onSave,
  onUpdateSettings,
  saving,
  passwordChangeLocked,
  isAdmin
}: AccountSettingsProps) {
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false
  })

  return (
    <div className="max-w-2xl space-y-6">
      <div className="bg-white border border-charcoal/10 p-8 rounded-md shadow-sm">
        <div className="flex items-center gap-4 mb-8 pb-4 border-b border-charcoal/5">
          <div className="w-10 h-10 rounded bg-charcoal/5 flex items-center justify-center text-charcoal/30">
            <User size={20} />
          </div>
          <div>
            <h3 className="text-[12px] font-semibold text-charcoal uppercase tracking-wider">Access Configuration</h3>
            <p className="text-[11px] text-charcoal/40 font-medium mt-0.5">Manage your sign-in credentials{isAdmin ? ' and alert routing' : ''}.</p>
          </div>
        </div>

        {passwordChangeLocked && (
          <div className="mb-8 p-4 bg-brass/5 border border-brass/20 rounded flex items-start gap-4">
            <ShieldAlert className="text-brass shrink-0 mt-0.5" size={16} />
            <p className="text-[12px] text-charcoal/65 leading-relaxed font-medium">
              Credential modification is currently restricted. Your access remains active.
            </p>
          </div>
        )}

        <form onSubmit={onSave} className="space-y-6">
          <div className="space-y-6">
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-charcoal/40 uppercase tracking-wide ml-1">Username</label>
              <input type="text" value={settings.username} onChange={(e) => onUpdateSettings({...settings, username: e.target.value})} required className="w-full md:w-1/2 px-3 py-2 bg-warm-stone/20 border border-charcoal/10 rounded-md text-[13px] outline-none font-semibold focus:border-charcoal transition-all" />
            </div>

            {isAdmin && <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-charcoal/40 uppercase tracking-wide ml-1">Alert Emails</label>
              <textarea
                value={settings.notificationEmails}
                onChange={(e) => onUpdateSettings({...settings, notificationEmails: e.target.value})}
                placeholder="admin@bestworth.com, support@bestworth.com"
                rows={4}
                className="w-full px-3 py-2 bg-warm-stone/20 border border-charcoal/10 rounded-md text-[13px] outline-none focus:border-charcoal transition-all resize-none"
              />
              <p className="text-[10px] text-charcoal/30 ml-1">Provide a comma-separated list of recipients for enterprise notifications.</p>
            </div>}
          </div>

          <div className="h-px bg-charcoal/5 my-2" />

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-charcoal/40 uppercase tracking-wide ml-1">Current Key</label>
              <div className="relative">
                <input type={showPasswords.current ? 'text' : 'password'} value={passwordChangeLocked ? '••••••••••••' : settings.currentPassword} onChange={(e) => !passwordChangeLocked && onUpdateSettings({...settings, currentPassword: e.target.value})} required={!passwordChangeLocked} disabled={passwordChangeLocked} className="w-full px-3 py-2 bg-warm-stone/20 border border-charcoal/10 rounded-md text-[13px] outline-none font-mono disabled:opacity-50 focus:border-charcoal" />
                <button type="button" onClick={() => setShowPasswords(p => ({...p, current: !p.current}))} className="absolute right-3 top-1/2 -translate-y-1/2 text-charcoal/20 hover:text-charcoal">{showPasswords.current ? <EyeOff size={14}/> : <Eye size={14}/>}</button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-charcoal/40 uppercase tracking-wide ml-1">New Key</label>
                <div className="relative">
                  <input type={showPasswords.new ? 'text' : 'password'} value={settings.newPassword} onChange={(e) => onUpdateSettings({...settings, newPassword: e.target.value})} disabled={passwordChangeLocked} className="w-full px-3 py-2 bg-warm-stone/20 border border-charcoal/10 rounded-md text-[13px] outline-none font-mono disabled:opacity-50 focus:border-charcoal" />
                  <button type="button" onClick={() => setShowPasswords(p => ({...p, new: !p.new}))} className="absolute right-3 top-1/2 -translate-y-1/2 text-charcoal/20 hover:text-charcoal">{showPasswords.new ? <EyeOff size={14}/> : <Eye size={14}/>}</button>
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-charcoal/40 uppercase tracking-wide ml-1">Confirm Key</label>
                <div className="relative">
                  <input type={showPasswords.confirm ? 'text' : 'password'} value={settings.confirmNewPassword} onChange={(e) => onUpdateSettings({...settings, confirmNewPassword: e.target.value})} disabled={passwordChangeLocked} className="w-full px-3 py-2 bg-warm-stone/20 border border-charcoal/10 rounded-md text-[13px] outline-none font-mono disabled:opacity-50 focus:border-charcoal" />
                  <button type="button" onClick={() => setShowPasswords(p => ({...p, confirm: !p.confirm}))} className="absolute right-3 top-1/2 -translate-y-1/2 text-charcoal/20 hover:text-charcoal">{showPasswords.confirm ? <EyeOff size={14}/> : <Eye size={14}/>}</button>
                </div>
              </div>
            </div>
          </div>

          <button type="submit" disabled={saving} className="w-full py-3 bg-charcoal text-white rounded-md text-[12px] font-semibold uppercase tracking-wider hover:bg-black transition-all flex items-center justify-center gap-2 disabled:opacity-50 shadow-sm">
            {saving ? <Lock size={14} className="animate-pulse" /> : <Save size={14} />} Save Changes
          </button>
        </form>
      </div>
    </div>
  )
}

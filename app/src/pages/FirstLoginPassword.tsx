import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiUrl } from '@/lib/api'

export default function FirstLoginPassword() {
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmNewPassword: '' })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const navigate = useNavigate()

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      const token = localStorage.getItem('adminToken')
      const response = await fetch(apiUrl('/api/auth/change-password'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(form)
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.message || 'Password change failed')
      navigate('/admin', { replace: true })
    } catch (changeError) {
      setError(changeError instanceof Error ? changeError.message : 'Password change failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F5F8FC] p-5">
      <section className="w-full max-w-lg rounded-xl border border-[#102B4C]/10 bg-white p-7 shadow-[0_24px_70px_rgba(16,43,76,0.08)] sm:p-10">
        <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[#060273]">Secure your account</p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight text-[#102B4C]">Create your private password</h1>
        <p className="mt-2 text-[13px] leading-6 text-[#102B4C]/55">Your temporary password can only be used for this first sign-in. Choose at least eight characters.</p>
        {error && <div className="mt-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-[12px] text-red-700">{error}</div>}
        <form onSubmit={submit} className="mt-7 space-y-5">
          {([
            ['currentPassword', 'Temporary password'],
            ['newPassword', 'New password'],
            ['confirmNewPassword', 'Confirm new password']
          ] as const).map(([key, label]) => (
            <label key={key} className="block text-[11px] font-semibold text-[#102B4C]/65">
              {label}
              <input type="password" required minLength={key === 'currentPassword' ? undefined : 8} value={form[key]} onChange={(event) => setForm({ ...form, [key]: event.target.value })} className="mt-2 w-full rounded-lg border border-[#102B4C]/10 bg-[#F7F9FC] px-4 py-3 text-sm outline-none focus:border-[#060273]/40 focus:ring-2 focus:ring-[#060273]/10" />
            </label>
          ))}
          <button disabled={saving} className="w-full rounded-lg bg-[#060273] px-5 py-3.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-white disabled:opacity-50">{saving ? 'Securing account…' : 'Save and continue'}</button>
        </form>
      </section>
    </main>
  )
}

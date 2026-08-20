import { Eye } from 'lucide-react'

export default function ReadOnlyNotice() {
  return (
    <div className="mb-5 flex items-start gap-3 rounded-lg border border-[#102B4C]/10 bg-[#F7F9FC] px-4 py-3 text-[#102B4C]">
      <Eye size={16} className="mt-0.5 shrink-0 text-[#060273]" />
      <div>
        <p className="text-[12px] font-semibold">View-only access</p>
        <p className="mt-0.5 text-[11px] leading-5 text-[#102B4C]/55">You can review this module, but only the owner can change its current records or settings.</p>
      </div>
    </div>
  )
}

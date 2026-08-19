import { Package, MessageSquare, Users, Globe, ShieldCheck, Activity } from 'lucide-react'

interface OverviewProps {
  stats: { products: number; inquiries: number; team: number }
}

export default function Overview({ stats }: OverviewProps) {
  const cards = [
    { label: 'Products', value: stats.products, icon: Package },
    { label: 'Inquiries', value: stats.inquiries, icon: MessageSquare },
    { label: 'Team', value: stats.team, icon: Users },
  ]

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {cards.map((card, i) => (
          <div key={i} className="bg-white border border-charcoal/10 p-6 rounded-md shadow-sm flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-charcoal/40 mb-1">{card.label}</p>
              <p className="text-3xl font-semibold text-charcoal tracking-tight">{card.value}</p>
            </div>
            <div className="w-10 h-10 rounded bg-warm-stone/50 flex items-center justify-center text-charcoal/20">
              <card.icon size={20} />
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-8">
        <div className="bg-white border border-charcoal/10 p-6 rounded-md shadow-sm">
          <div className="flex items-center justify-between mb-6 pb-3 border-b border-charcoal/5">
            <h3 className="text-[12px] font-semibold text-charcoal uppercase tracking-wider">System Status</h3>
            <Activity size={14} className="text-green-500" />
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-3 p-3 bg-warm-stone/20 rounded border border-charcoal/5">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div>
              <div className="flex-1">
                <p className="text-[13px] font-medium text-charcoal">Backend Operational</p>
                <p className="text-[10px] text-charcoal/40 uppercase tracking-widest mt-0.5">TLS Secured • 20ms</p>
              </div>
              <ShieldCheck size={16} className="text-charcoal/10" />
            </div>

            <div className="flex items-center gap-3 p-3 bg-warm-stone/20 rounded border border-charcoal/5">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
              <div className="flex-1">
                <p className="text-[13px] font-medium text-charcoal">Database Synced</p>
                <p className="text-[10px] text-charcoal/40 uppercase tracking-widest mt-0.5">Atlas Multi-Region</p>
              </div>
              <Globe size={16} className="text-charcoal/10" />
            </div>
          </div>
        </div>

        <div className="bg-charcoal p-8 rounded-md shadow-sm flex flex-col justify-center">
          <p className="text-brass font-bold text-[10px] uppercase tracking-[0.2em] mb-2">Insight</p>
          <h4 className="text-white font-medium text-lg leading-snug max-w-xs">
            Directly manage your enterprise resources through the Site CMS for real-time synchronization.
          </h4>
        </div>
      </div>
    </div>
  )
}

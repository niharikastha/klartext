import { ShieldAlert, ShieldCheck, ShieldX } from 'lucide-react'
import { clsx } from 'clsx'

interface RiskBadgeProps {
  level: 'low' | 'medium' | 'high'
  size?: 'sm' | 'md'
}

const config = {
  low: {
    label: 'Low Risk',
    icon: ShieldCheck,
    className: 'bg-green-50 text-green-700 border border-green-200',
  },
  medium: {
    label: 'Medium Risk',
    icon: ShieldAlert,
    className: 'bg-yellow-50 text-yellow-700 border border-yellow-200',
  },
  high: {
    label: 'High Risk',
    icon: ShieldX,
    className: 'bg-red-50 text-red-700 border border-red-200',
  },
}

export function RiskBadge({ level, size = 'sm' }: RiskBadgeProps) {
  const { label, icon: Icon, className } = config[level] || config.low

  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-full font-medium',
        size === 'sm' ? 'px-2.5 py-0.5 text-xs' : 'px-3 py-1 text-sm',
        className,
      )}
    >
      <Icon size={size === 'sm' ? 12 : 14} />
      {label}
    </span>
  )
}

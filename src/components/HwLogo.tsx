import { forwardRef } from 'react'

interface HwLogoProps {
  size?: number
  className?: string
}

export const HwLogo = forwardRef<HTMLDivElement, HwLogoProps>(
  ({ size = 64, className = '' }, ref) => {
    return (
      <div ref={ref} className={className} style={{ width: size, height: size, flexShrink: 0 }}>
        <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 200 200" fill="none">
          <defs>
            <linearGradient id="hw-base" x1="20" y1="20" x2="180" y2="180"><stop offset="0%" stopColor="#1c1c20"/><stop offset="40%" stopColor="#151517"/><stop offset="100%" stopColor="#0c0c0e"/></linearGradient>
            <linearGradient id="hw-bevel" x1="100" y1="24" x2="100" y2="176"><stop offset="0%" stopColor="white" stopOpacity="0.06"/><stop offset="15%" stopColor="white" stopOpacity="0.02"/><stop offset="85%" stopColor="black" stopOpacity="0.04"/><stop offset="100%" stopColor="black" stopOpacity="0.12"/></linearGradient>
            <radialGradient id="hw-shine" cx="40" cy="40" r="100" gradientUnits="userSpaceOnUse"><stop offset="0%" stopColor="white" stopOpacity="0.14"/><stop offset="30%" stopColor="white" stopOpacity="0.04"/><stop offset="60%" stopColor="white" stopOpacity="0"/></radialGradient>
            <linearGradient id="hw-spec" x1="52" y1="20" x2="148" y2="20"><stop offset="0%" stopColor="white" stopOpacity="0"/><stop offset="20%" stopColor="white" stopOpacity="0.2"/><stop offset="50%" stopColor="white" stopOpacity="0.3"/><stop offset="80%" stopColor="white" stopOpacity="0.2"/><stop offset="100%" stopColor="white" stopOpacity="0"/></linearGradient>
            <radialGradient id="hw-glow" cx="100" cy="100" r="65" gradientUnits="userSpaceOnUse"><stop offset="0%" stopColor="#DC2626" stopOpacity="0.18"/><stop offset="40%" stopColor="#DC2626" stopOpacity="0.08"/><stop offset="100%" stopColor="#DC2626" stopOpacity="0"/></radialGradient>
            <linearGradient id="hw-wave" x1="40" y1="100" x2="160" y2="100" gradientUnits="userSpaceOnUse"><stop offset="0%" stopColor="#DC2626" stopOpacity="0.3"/><stop offset="12%" stopColor="#DC2626"/><stop offset="50%" stopColor="#EF4444"/><stop offset="88%" stopColor="#DC2626"/><stop offset="100%" stopColor="#DC2626" stopOpacity="0.3"/></linearGradient>
            <filter id="hw-blur" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="6"/></filter>
            <clipPath id="hw-clip"><rect x="20" y="20" width="160" height="160" rx="32"/></clipPath>
          </defs>
          <rect x="20" y="20" width="160" height="160" rx="32" fill="url(#hw-base)"/>
          <rect x="20" y="20" width="160" height="160" rx="32" fill="url(#hw-bevel)"/>
          <rect x="20" y="20" width="160" height="160" rx="32" fill="url(#hw-shine)"/>
          <rect x="20" y="20" width="160" height="160" rx="32" stroke="white" strokeWidth="1" strokeOpacity="0.07" fill="none"/>
          <path d="M52 20 H148" stroke="url(#hw-spec)" strokeWidth="1.5"/>
          <g clipPath="url(#hw-clip)"><ellipse cx="100" cy="100" rx="65" ry="50" fill="url(#hw-glow)"/></g>
          <g clipPath="url(#hw-clip)">
            <path d="M40 100 H52 L58 93 L66 58 L74 138 L82 68 L88 130 L94 86 L100 114 L106 94 L112 106 L118 100 H160" stroke="#DC2626" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" fill="none" filter="url(#hw-blur)" opacity="0.5"/>
          </g>
          <path d="M40 100 H52 L58 93 L66 58 L74 138 L82 68 L88 130 L94 86 L100 114 L106 94 L112 106 L118 100 H160" stroke="url(#hw-wave)" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
        </svg>
      </div>
    )
  }
)

HwLogo.displayName = 'HwLogo'

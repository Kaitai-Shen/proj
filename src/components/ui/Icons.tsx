import type { ReactNode, SVGProps } from "react";

export type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Svg({
  size = 18,
  children,
  ...props
}: IconProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  );
}

export function LogoMark({ size = 28, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <rect width="32" height="32" rx="9" fill="var(--site-accent)" />
      <path
        d="M7 19.5c3.2-9 6.4-9 9.5 0s6.3 9 8.5 0"
        stroke="var(--site-on-accent)"
        strokeWidth="2.1"
        strokeLinecap="round"
      />
      <circle cx="24.4" cy="11" r="1.9" fill="var(--site-on-accent)" />
    </svg>
  );
}

export const ArrowRight = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5 12h13" />
    <path d="m13 6 6 6-6 6" />
  </Svg>
);

export const ArrowLeft = (p: IconProps) => (
  <Svg {...p}>
    <path d="M19 12H6" />
    <path d="m11 18-6-6 6-6" />
  </Svg>
);

export const ArrowUpRight = (p: IconProps) => (
  <Svg {...p}>
    <path d="M7 17 17 7" />
    <path d="M8 7h9v9" />
  </Svg>
);

export const BookOpen = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 6.5C10.5 5 8 4.5 4.5 5v13c3.5-.5 6 0 7.5 1.5 1.5-1.5 4-2 7.5-1.5V5C16 4.5 13.5 5 12 6.5Z" />
    <path d="M12 6.5V19.5" />
  </Svg>
);

export const Film = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3" y="5" width="18" height="14" rx="2.5" />
    <path d="M7 5v14M17 5v14M3 9.5h4M3 14.5h4M17 9.5h4M17 14.5h4" />
  </Svg>
);

export const Play = (p: IconProps) => (
  <Svg {...p}>
    <path d="M9 6.8v10.4a.8.8 0 0 0 1.22.68l8.3-5.2a.8.8 0 0 0 0-1.36l-8.3-5.2A.8.8 0 0 0 9 6.8Z" />
  </Svg>
);

export const Download = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 4v10" />
    <path d="m7.5 10 4.5 4 4.5-4" />
    <path d="M5 19h14" />
  </Svg>
);

export const Check = (p: IconProps) => (
  <Svg {...p}>
    <path d="m5 12.5 4.5 4.5L19 7" />
  </Svg>
);

export const CheckCircle = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="m8.5 12.3 2.4 2.4 4.6-4.9" />
  </Svg>
);

export const X = (p: IconProps) => (
  <Svg {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Svg>
);

export const XCircle = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="m9 9 6 6M15 9l-6 6" />
  </Svg>
);

export const ChevronDown = (p: IconProps) => (
  <Svg {...p}>
    <path d="m6 9.5 6 6 6-6" />
  </Svg>
);

export const ChevronUp = (p: IconProps) => (
  <Svg {...p}>
    <path d="m6 14.5 6-6 6 6" />
  </Svg>
);

export const Settings = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M12 3.5v2.2M12 18.3v2.2M20.5 12h-2.2M5.7 12H3.5M18 6l-1.6 1.6M7.6 16.4 6 18M18 18l-1.6-1.6M7.6 7.6 6 6" />
  </Svg>
);

export const HelpCircle = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M9.6 9.3a2.5 2.5 0 1 1 3.6 2.3c-.8.4-1.2.9-1.2 1.8" />
    <path d="M12 16.6h.01" />
  </Svg>
);

export const Folder = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3.5 7.5A2 2 0 0 1 5.5 5.5h3.2l2 2.2h7.8a2 2 0 0 1 2 2v7.8a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2Z" />
  </Svg>
);

export const Code = (p: IconProps) => (
  <Svg {...p}>
    <path d="m8.5 8-4 4 4 4M15.5 8l4 4-4 4" />
    <path d="m13.2 5-2.4 14" />
  </Svg>
);

export const FileText = (p: IconProps) => (
  <Svg {...p}>
    <path d="M6 3.8h7l5 5V20a1 1 0 0 1-1 1H6.8a1 1 0 0 1-1-1V4.8a1 1 0 0 1 1-1Z" />
    <path d="M13 3.8V9h5M9 13h6M9 17h6" />
  </Svg>
);

export const MessageSquare = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 5.8h16v10.4H9.4L4 19.2Z" />
    <path d="M8 10h8M8 13h5" />
  </Svg>
);

export const Volume2 = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 9.5h3l4.5-3.8v12.6L7 14.5H4Z" />
    <path d="M16 8.6a5 5 0 0 1 0 6.8M18.6 6a8.5 8.5 0 0 1 0 12" />
  </Svg>
);

export const Layers = (p: IconProps) => (
  <Svg {...p}>
    <path d="m12 3.8 8.5 4.4-8.5 4.4L3.5 8.2Z" />
    <path d="m4 12.2 8 4.1 8-4.1M4 16.2l8 4.1 8-4.1" />
  </Svg>
);

export const Clock = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </Svg>
);

export const AlertTriangle = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 4.2 21 19.5H3Z" />
    <path d="M12 9.5v4.4M12 17h.01" />
  </Svg>
);

export const Refresh = (p: IconProps) => (
  <Svg {...p}>
    <path d="M20 11.5A8 8 0 1 0 18.2 17" />
    <path d="M20 5.5v6h-6" />
  </Svg>
);

export const Loader = (p: IconProps) => (
  <Svg {...p} className={`animate-spin ${p.className ?? ""}`}>
    <path d="M12 3.5a8.5 8.5 0 0 1 8.5 8.5" />
    <path d="M20.5 12a8.5 8.5 0 0 1-8.5 8.5" opacity="0.35" />
  </Svg>
);

export const Sparkles = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 3.5 13.6 8l4.4 1.6L13.6 11 12 15.5 10.4 11 6 9.6 10.4 8Z" />
    <path d="M18.5 15.5 19.3 18l2.2.8-2.2.8-.8 2.4-.8-2.4-2.2-.8 2.2-.8Z" />
  </Svg>
);

export const Wave = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3 14c3-7 6-7 9 0s6 7 9 0" />
  </Svg>
);

export const Trophy = (p: IconProps) => (
  <Svg {...p}>
    <path d="M8 4.5h8v4.2a4 4 0 0 1-8 0Z" />
    <path d="M8 6H4.8a3.2 3.2 0 0 0 3.2 3.2M16 6h3.2a3.2 3.2 0 0 1-3.2 3.2M12 12.7V17M8.5 19.5h7" />
  </Svg>
);

export const Lightbulb = (p: IconProps) => (
  <Svg {...p}>
    <path d="M9 15.5a6 6 0 1 1 6 0c-.8.6-1 1.2-1 2.2H10c0-1-.2-1.6-1-2.2Z" />
    <path d="M10 20.5h4" />
  </Svg>
);

export const ExternalLink = (p: IconProps) => (
  <Svg {...p}>
    <path d="M14 4.5h5.5V10" />
    <path d="M19.5 4.5 11 13" />
    <path d="M18 14v4.5a1 1 0 0 1-1 1H5.5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1H10" />
  </Svg>
);

export const Lock = (p: IconProps) => (
  <Svg {...p}>
    <rect x="5" y="10.5" width="14" height="9.5" rx="2" />
    <path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" />
  </Svg>
);

export const Eye = (p: IconProps) => (
  <Svg {...p}>
    <path d="M2.8 12S6.2 5.8 12 5.8 21.2 12 21.2 12 17.8 18.2 12 18.2 2.8 12 2.8 12Z" />
    <circle cx="12" cy="12" r="3" />
  </Svg>
);

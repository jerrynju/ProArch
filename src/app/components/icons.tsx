// SVG icon set — paths taken from the design file so strokes match exactly.
import type { CSSProperties } from 'react';

interface P {
  size?: number;
  color?: string;
  strokeWidth?: number;
  style?: CSSProperties;
  fill?: boolean;
}

function S({ size = 18, color = 'currentColor', strokeWidth = 1.8, style, children }: P & { children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" style={style}>
      {children}
    </svg>
  );
}

function F({ size = 18, color = 'currentColor', style, children }: P & { children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill={color} stroke="none" style={style}>
      {children}
    </svg>
  );
}

export const IcMenu = (p: P) => <S {...p}><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></S>;
export const IcHome = (p: P) => <S {...p}><path d="M4 11.5 12 4l8 7.5" /><path d="M6 10v9a1 1 0 0 0 1 1h4v-6h2v6h4a1 1 0 0 0 1-1v-9" /></S>;
export const IcRobot = (p: P) => (
  <svg viewBox="0 0 24 24" width={p.size ?? 21} height={p.size ?? 21} fill="none" stroke={p.color ?? 'currentColor'} strokeWidth={p.strokeWidth ?? 1.8} strokeLinecap="round" strokeLinejoin="round" style={p.style}>
    <rect x="5" y="9" width="14" height="10" rx="3" /><line x1="12" y1="9" x2="12" y2="5" />
    <circle cx="12" cy="3.5" r="1.3" fill={p.color ?? 'currentColor'} stroke="none" />
    <circle cx="9" cy="14" r="1.2" fill={p.color ?? 'currentColor'} stroke="none" />
    <circle cx="15" cy="14" r="1.2" fill={p.color ?? 'currentColor'} stroke="none" />
    <line x1="9" y1="18" x2="15" y2="18" />
  </svg>
);
export const IcDots = (p: P) => <F {...p}><circle cx="12" cy="5" r="1.9" /><circle cx="12" cy="12" r="1.9" /><circle cx="12" cy="19" r="1.9" /></F>;
export const IcSparkle = (p: P) => <F {...p}><path d="M12 2l1.6 5.4L19 9l-5.4 1.6L12 16l-1.6-5.4L5 9l5.4-1.6L12 2z" /></F>;
export const IcSend = (p: P) => <F {...p}><path d="M3 11l18-8-8 18-2-8-8-2z" /></F>;
export const IcBookmark = (p: P) => <S {...p}><path d="M7 3h10v18l-5-3.5L7 21V3z" /></S>;
export const IcBack = (p: P) => <S strokeWidth={2.2} {...p}><polyline points="15 18 9 12 15 6" /></S>;
export const IcChevronRight = (p: P) => <S strokeWidth={2} {...p}><polyline points="9 6 15 12 9 18" /></S>;
export const IcChevronDown = (p: P) => <S strokeWidth={2} {...p}><polyline points="6 9 12 15 18 9" /></S>;
export const IcChevronUp = (p: P) => <S strokeWidth={2.2} {...p}><polyline points="18 15 12 9 6 15" /></S>;
export const IcClose = (p: P) => <S strokeWidth={2} {...p}><line x1="6" y1="6" x2="18" y2="18" /><line x1="18" y1="6" x2="6" y2="18" /></S>;
export const IcTrend = (p: P) => <S strokeWidth={1.9} {...p}><path d="M4 17l4-6 4 3 5-8 3 4" /></S>;
export const IcPlot = (p: P) => <S {...p}><polyline points="4 16 9 10 13 14 20 6" /></S>;
export const IcNote = (p: P) => <S {...p}><rect x="4" y="3" width="16" height="18" rx="2" /><line x1="7" y1="8" x2="17" y2="8" /><line x1="7" y1="12" x2="17" y2="12" /><line x1="7" y1="16" x2="13" y2="16" /></S>;
export const IcTable = (p: P) => <S {...p}><rect x="3" y="4" width="18" height="16" rx="2" /><line x1="3" y1="10" x2="21" y2="10" /><line x1="9" y1="4" x2="9" y2="20" /></S>;
export const IcWave = (p: P) => <S {...p}><polyline points="2 12 6 12 8 6 12 18 15 12 22 12" /></S>;
export const IcStar = ({ size = 16, style }: P) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="#F5B301" stroke="#F5B301" strokeWidth={1.5} style={style}>
    <path d="M12 2l2.9 6.6 7.1.7-5.4 4.8 1.6 7-6.2-3.7-6.2 3.7 1.6-7-5.4-4.8 7.1-.7z" />
  </svg>
);
export const IcFolder = (p: P) => <S {...p}><path d="M3 6a1 1 0 0 1 1-1h5l2 2h9a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6z" /></S>;
export const IcFolderPlus = (p: P) => <S {...p}><path d="M3 6a1 1 0 0 1 1-1h5l2 2h9a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6z" /><line x1="12" y1="10.5" x2="12" y2="15.5" /><line x1="9.5" y1="13" x2="14.5" y2="13" /></S>;
export const IcFile = (p: P) => <S {...p}><path d="M6 2h9l4 4v16H6V2z" /><line x1="10" y1="12" x2="16" y2="12" /><line x1="10" y1="16" x2="16" y2="16" /></S>;
export const IcFilePlus = (p: P) => <S {...p}><path d="M6 2h9l4 4v16H6V2z" /><line x1="12" y1="9" x2="12" y2="15" /><line x1="9" y1="12" x2="15" y2="12" /></S>;
export const IcPlus = (p: P) => <S strokeWidth={2} {...p}><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></S>;
export const IcGear = (p: P) => <S {...p}><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" /></S>;
export const IcSun = (p: P) => <S {...p}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M2 12h2M20 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" /></S>;
export const IcMoon = (p: P) => <S {...p}><path d="M20 14.5A8.5 8.5 0 0 1 9.5 4 8.5 8.5 0 1 0 20 14.5z" /></S>;
export const IcDownload = (p: P) => <S {...p}><path d="M12 3v12" /><polyline points="7 10 12 15 17 10" /><line x1="5" y1="20" x2="19" y2="20" /></S>;
export const IcUpload = (p: P) => <S {...p}><path d="M12 3v12" /><polyline points="7 8 12 3 17 8" /><path d="M5 15v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4" /></S>;
export const IcCode = (p: P) => <S {...p}><polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" /></S>;
export const IcShare = (p: P) => <S {...p}><circle cx="18" cy="5" r="2.6" /><circle cx="6" cy="12" r="2.6" /><circle cx="18" cy="19" r="2.6" /><line x1="8.2" y1="10.8" x2="15.8" y2="6.2" /><line x1="8.2" y1="13.2" x2="15.8" y2="17.8" /></S>;
export const IcCopyLink = (p: P) => <S {...p}><rect x="4" y="4" width="12" height="12" rx="2" /><path d="M8 16v2a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-2" /></S>;
export const IcPrint = (p: P) => <S {...p}><polyline points="6 9 6 2 18 2 18 9" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><rect x="6" y="14" width="12" height="8" /></S>;
export const IcCheckCircle = (p: P) => <S strokeWidth={2.2} {...p}><circle cx="12" cy="12" r="9" /><polyline points="8 12 11 15 16 9" /></S>;
export const IcXCircle = (p: P) => <S strokeWidth={2.2} {...p}><circle cx="12" cy="12" r="9" /><line x1="9" y1="9" x2="15" y2="15" /><line x1="15" y1="9" x2="9" y2="15" /></S>;
export const IcUser = (p: P) => <S {...p}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></S>;
export const IcLogout = (p: P) => <S {...p}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></S>;
export const IcGrid = (p: P) => <S {...p}><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></S>;
export const IcArrowUp = (p: P) => <S strokeWidth={2} {...p}><line x1="12" y1="19" x2="12" y2="5" /><polyline points="6 11 12 5 18 11" /></S>;
export const IcArrowDown = (p: P) => <S strokeWidth={2} {...p}><line x1="12" y1="5" x2="12" y2="19" /><polyline points="6 13 12 19 18 13" /></S>;
export const IcCopy = (p: P) => <S {...p}><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h10" /></S>;
export const IcTrash = (p: P) => <S {...p}><polyline points="4 7 20 7" /><path d="M6 7V4h12v3M8 7v13h8V7" /></S>;
export const IcWarning = (p: P) => <S {...p}><path d="M12 9v4M12 17h.01" /><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" /></S>;
export const IcAntenna = (p: P) => <S {...p}><circle cx="12" cy="12" r="2" /><path d="M7.8 16.2a6 6 0 0 1 0-8.4M16.2 7.8a6 6 0 0 1 0 8.4M5 19a10 10 0 0 1 0-14M19 5a10 10 0 0 1 0 14" /></S>;
export const IcWrench = (p: P) => <S {...p}><path d="M14.7 6.3a4 4 0 0 0-5.6 5.1L3 17.5V21h3.5l6.1-6.1a4 4 0 0 0 5.1-5.6L14.9 12l-2.9-2.9 2.7-2.8z" /></S>;
export const IcPencil = (p: P) => <S {...p}><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></S>;
export const IcLock = (p: P) => <S {...p}><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></S>;

// Inline SVGs — no icon dependency, and nothing to load at runtime.
type P = { className?: string };

export const IconSearch = ({ className = "h-4 w-4" }: P) => (
  <svg className={className} viewBox="0 0 24 24" fill="none"
       stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
    <circle cx="11" cy="11" r="7" /><path d="m20 20-3.2-3.2" />
  </svg>
);

export const IconDots = ({ className = "h-5 w-5" }: P) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <circle cx="5" cy="12" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="19" cy="12" r="1.8" />
  </svg>
);

export const IconChevron = ({ className = "h-4 w-4" }: P) => (
  <svg className={className} viewBox="0 0 24 24" fill="none"
       stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="m6 9 6 6 6-6" />
  </svg>
);

export const IconClose = ({ className = "h-5 w-5" }: P) => (
  <svg className={className} viewBox="0 0 24 24" fill="none"
       stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);

export const IconMenu = ({ className = "h-5 w-5" }: P) => (
  <svg className={className} viewBox="0 0 24 24" fill="none"
       stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </svg>
);

export const IconHelp = ({ className = "h-5 w-5" }: P) => (
  <svg className={className} viewBox="0 0 24 24" fill="none"
       stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
    <circle cx="12" cy="12" r="9" />
    <path d="M9.2 9.3a2.9 2.9 0 1 1 3.6 2.8c-.5.2-.8.7-.8 1.2v.4" />
    <path d="M12 17.2h.01" />
  </svg>
);

export const IconCalendar = ({ className = "h-5 w-5" }: P) => (
  <svg className={className} viewBox="0 0 24 24" fill="none"
       stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
    <rect x="3.5" y="5" width="17" height="15" rx="2.5" />
    <path d="M3.5 9.5h17M8 3.5v3M16 3.5v3" />
  </svg>
);

export const IconGear = ({ className = "h-5 w-5" }: P) => (
  <svg className={className} viewBox="0 0 24 24" fill="none"
       stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <circle cx="12" cy="12" r="3.2" />
    <path d="M19.4 14.6a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1v.2a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-2.8-1.1l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0-1.1-2.7h-.2a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.1-2.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 2.7-1.1V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 2.8 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0 1.1 2.7h.2a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z" />
  </svg>
);

export const IconRefresh = ({ className = "h-3.5 w-3.5" }: P) => (
  <svg className={className} viewBox="0 0 24 24" fill="none"
       stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M3 11a9 9 0 0 1 15.3-5.6L21 8" /><path d="M21 4v4h-4" />
    <path d="M21 13a9 9 0 0 1-15.3 5.6L3 16" /><path d="M3 20v-4h4" />
  </svg>
);

export const IconBulb = ({ className = "h-4 w-4" }: P) => (
  <svg className={className} viewBox="0 0 24 24" fill="none"
       stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M9 18h6M10 21.5h4" />
    <path d="M12 2.5a6.5 6.5 0 0 0-3.8 11.8c.5.4.8 1 .8 1.7h6c0-.7.3-1.3.8-1.7A6.5 6.5 0 0 0 12 2.5z" />
  </svg>
);

export const IconFlag = ({ className = "h-4 w-4" }: P) => (
  <svg className={className} viewBox="0 0 24 24" fill="none"
       stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M5 21V4M5 4h10l-1.5 3.5L15 11H5" />
  </svg>
);

export const IconShare = ({ className = "h-4 w-4" }: P) => (
  <svg className={className} viewBox="0 0 24 24" fill="none"
       stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M12 3v13M12 3 8 7M12 3l4 4" />
    <path d="M5 14v5.5A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5V14" />
  </svg>
);

export const IconMail = ({ className = "h-4 w-4" }: P) => (
  <svg className={className} viewBox="0 0 24 24" fill="none"
       stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <rect x="3" y="5" width="18" height="14" rx="2.5" /><path d="m3.5 7 8.5 6 8.5-6" />
  </svg>
);

export const IconX = ({ className = "h-4 w-4" }: P) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="M17.5 3h3l-6.6 7.6L21.7 21h-6l-4.7-6.2L5.6 21h-3l7-8.1L2.6 3h6.2l4.3 5.7L17.5 3zm-1 16h1.6L7.6 4.6H5.9L16.5 19z" />
  </svg>
);

export const IconYoutube = ({ className = "h-4 w-4" }: P) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="M21.6 7.2a2.5 2.5 0 0 0-1.8-1.8C18.2 5 12 5 12 5s-6.2 0-7.8.4A2.5 2.5 0 0 0 2.4 7.2 26 26 0 0 0 2 12a26 26 0 0 0 .4 4.8 2.5 2.5 0 0 0 1.8 1.8C5.8 19 12 19 12 19s6.2 0 7.8-.4a2.5 2.5 0 0 0 1.8-1.8A26 26 0 0 0 22 12a26 26 0 0 0-.4-4.8zM10 15V9l5.2 3L10 15z" />
  </svg>
);

export const IconMegaphone = ({ className = "h-4 w-4" }: P) => (
  <svg className={className} viewBox="0 0 24 24" fill="none"
       stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M3 10v4h3l6 4V6l-6 4H3z" /><path d="M16.5 9.5a3.5 3.5 0 0 1 0 5" />
  </svg>
);

export const IconUser = ({ className = "h-5 w-5" }: P) => (
  <svg className={className} viewBox="0 0 24 24" fill="none"
       stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
    <circle cx="12" cy="8.5" r="3.8" />
    <path d="M4.5 20a7.5 7.5 0 0 1 15 0" />
  </svg>
);

export const IconLock = ({ className = "h-4 w-4" }: P) => (
  <svg className={className} viewBox="0 0 24 24" fill="none"
       stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <rect x="4.5" y="10" width="15" height="10" rx="2.5" />
    <path d="M8 10V7.5a4 4 0 0 1 8 0V10" />
  </svg>
);

export const IconStar = ({ className = "h-4 w-4" }: P) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="m12 3.6 2.5 5.2 5.7.8-4.1 4 1 5.7-5.1-2.7-5.1 2.7 1-5.7-4.1-4 5.7-.8L12 3.6z" />
  </svg>
);

export const IconCheck = ({ className = "h-4 w-4" }: P) => (
  <svg className={className} viewBox="0 0 24 24" fill="none"
       stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="m5 12.5 4.5 4.5L19 7" />
  </svg>
);

export const IconGoogle = ({ className = "h-4 w-4" }: P) => (
  <svg className={className} viewBox="0 0 24 24" aria-hidden>
    <path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.4-.18-2.05H12v3.88h5.38a4.6 4.6 0 0 1-2 3.02v2.5h3.24c1.89-1.74 2.98-4.3 2.98-7.35z" />
    <path fill="#34A853" d="M12 22c2.7 0 4.96-.9 6.62-2.42l-3.24-2.5c-.9.6-2.05.96-3.38.96-2.6 0-4.8-1.76-5.59-4.12H3.06v2.59A10 10 0 0 0 12 22z" />
    <path fill="#FBBC05" d="M6.41 13.92a6 6 0 0 1 0-3.84V7.49H3.06a10 10 0 0 0 0 9.02l3.35-2.59z" />
    <path fill="#EA4335" d="M12 5.98c1.47 0 2.79.5 3.83 1.5l2.87-2.87C16.95 2.99 14.7 2 12 2A10 10 0 0 0 3.06 7.49l3.35 2.59C7.2 7.72 9.4 5.98 12 5.98z" />
  </svg>
);

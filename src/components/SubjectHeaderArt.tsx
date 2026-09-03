export function SubjectHeaderArt() {
  return (
    <svg className="subject-header-art" viewBox="0 0 420 120" role="img" aria-label="Study materials">
      <rect width="420" height="120" rx="20" fill="var(--surface-secondary)" />
      <path d="M0 91c72-29 135-17 194 2 70 23 143 17 226-20v47H0Z" fill="var(--primary-light)" />
      <g fill="none" stroke="var(--text-primary)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2">
        <path d="M64 30h75a10 10 0 0 1 10 10v54H74a10 10 0 0 0-10 10Z" fill="var(--surface)" />
        <path d="M224 30h75a10 10 0 0 1 10 10v64a10 10 0 0 0-10-10h-75Z" fill="var(--surface)" />
        <path d="M149 40c21-13 50-13 75 0v64c-25-13-54-13-75 0Z" fill="var(--surface)" />
        <path d="M87 51h36M87 64h46M87 77h29M245 51h42M245 64h30M245 77h39" opacity=".55" />
        <path d="m180 59 9 9 18-21" stroke="var(--primary)" strokeWidth="4" />
      </g>
      <circle cx="350" cy="31" r="8" fill="var(--primary)" />
      <path d="m350 13 2.7 10.5L363 27l-10.3 3.5L350 41l-2.7-10.5L337 27l10.3-3.5Z" fill="var(--primary)" opacity=".28" />
    </svg>
  );
}

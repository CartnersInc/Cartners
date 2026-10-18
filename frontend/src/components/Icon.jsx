const paths = {
  home: 'm3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z',
  plans: 'M5 5h14a1 1 0 0 1 1 1v14H4V6a1 1 0 0 1 1-1ZM8 3v4m8-4v4M4 10h16m-11 4h.01M15 14h.01M9 18h.01',
  shopping: 'M2 3h3l3 13h11l3-9H6m3 14h.01M18 21h.01',
  spending: 'M3 5h17v15H3Zm0 4h17m-5 4h5v4h-5Z',
  groups: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m20 0v-2a4 4 0 0 0-3-3.87M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8m8-7.87a4 4 0 0 1 0 7.75',
  arrow: 'M4 12h16m-6-6 6 6-6 6',
  leaf: 'M20 4C8 2 2 9 6 16s16 4 14-12ZM6 18l9-9',
  clock: 'M12 8v5l3 2m7-3a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
  salad: 'M3 12h18a9 8 0 0 1-18 0M9.5 20.5h5M6.5 12c-.6-2.6 1-4.6 3.6-4.6 0 2.1-1.4 3.8-3.6 4.6M11 12c.3-3 2.4-5 5.1-5 .2 2.7-1.7 4.7-5.1 5M17 10.3a1.5 1.5 0 1 0 3 0 1.5 1.5 0 0 0-3 0',
  chevron: 'm7 10 5 5 5-5',
  check: 'm5 12 4 4L19 6',
};
export default function Icon({ name, ...props }) {
  return <svg viewBox="0 0 24 24" className="icon" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}><path d={paths[name] || paths.arrow} /></svg>;
}

import type {ReactNode} from 'react';

/** Icon button for the scene rail, with the transitions.dev tooltip (delayed in, instant out). */
export default function RailButton({label, pressed, onClick, className = '', children}: {label: string; pressed?: boolean; onClick: () => void; className?: string; children: ReactNode}) {
  return <span className={`t-tt-wrap rail-item ${className}`}>
    <button className="t-tt-trigger rail-button" aria-label={label} aria-pressed={pressed} onClick={onClick}>{children}</button>
    <span className="t-tt t-tt--side" role="tooltip">{label}</span>
  </span>;
}

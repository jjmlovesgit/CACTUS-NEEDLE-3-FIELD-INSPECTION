import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface CollapsiblePanelProps {
  title: React.ReactNode;
  subtitle?: string;
  badge?: React.ReactNode;
  headerAction?: React.ReactNode;
  defaultExpanded?: boolean;
  children: React.ReactNode;
  className?: string;
}

export const CollapsiblePanel: React.FC<CollapsiblePanelProps> = ({
  title,
  subtitle,
  badge,
  headerAction,
  defaultExpanded = true,
  children,
  className = '',
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  return (
    <div className={`bg-slate-900/80 border border-slate-800 rounded-xl shadow-xl transition-all overflow-hidden ${className}`}>
      {/* Panel Header */}
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        className="px-5 py-4 flex items-center justify-between cursor-pointer select-none bg-slate-950/40 hover:bg-slate-950/70 border-b border-slate-800/60 transition-all"
      >
        <div className="flex items-center gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-200">
                {title}
              </h2>
              {badge}
            </div>
            {subtitle && (
              <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          {headerAction}
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-all"
            aria-label={isExpanded ? 'Collapse panel' : 'Expand panel'}
          >
            {isExpanded ? (
              <ChevronUp className="w-5 h-5" />
            ) : (
              <ChevronDown className="w-5 h-5" />
            )}
          </button>
        </div>
      </div>

      {/* Panel Content Body */}
      {isExpanded && <div className="p-5">{children}</div>}
    </div>
  );
};

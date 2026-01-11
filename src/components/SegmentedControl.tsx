import type { ReactNode } from 'react';
import './SegmentedControl.css';

export interface SegmentedControlOption<T extends string = string> {
  value: T;
  label: string;
  icon?: ReactNode;
  count?: number;
}

export interface SegmentedControlProps<T extends string = string> {
  options: SegmentedControlOption<T>[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
  variant?: 'default' | 'tabs' | 'buttons';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  iconOnly?: boolean;
}

/**
 * Reusable segmented control component for toggles, tabs, and mode switches.
 * 
 * @example
 * // Mode toggle (Search/Trending)
 * <SegmentedControl
 *   options={[
 *     { value: 'search', label: 'Search', icon: <SearchIcon /> },
 *     { value: 'trending', label: 'Trending', icon: <FireIcon /> }
 *   ]}
 *   value={mode}
 *   onChange={setMode}
 *   ariaLabel="Search mode"
 * />
 * 
 * @example
 * // View toggle (icon only)
 * <SegmentedControl
 *   options={[
 *     { value: 'grid', label: 'Grid View', icon: <GridIcon /> },
 *     { value: 'list', label: 'List View', icon: <ListIcon /> }
 *   ]}
 *   value={viewMode}
 *   onChange={setViewMode}
 *   ariaLabel="View mode"
 *   variant="buttons"
 *   size="sm"
 *   iconOnly
 * />
 * 
 * @example
 * // Format selector
 * <SegmentedControl
 *   options={[
 *     { value: 'Physical', label: 'Physical', icon: <BoxIcon /> },
 *     { value: 'Digital', label: 'Digital', icon: <CloudIcon /> }
 *   ]}
 *   value={format}
 *   onChange={setFormat}
 *   ariaLabel="Game format"
 *   variant="buttons"
 *   fullWidth
 * />
 */
export function SegmentedControl<T extends string = string>({
  options,
  value,
  onChange,
  ariaLabel,
  variant = 'default',
  size = 'md',
  fullWidth = false,
  iconOnly = false,
}: SegmentedControlProps<T>) {
  return (
    <div
      className={`segmented-control segmented-control--${variant} segmented-control--${size} ${fullWidth ? 'segmented-control--full-width' : ''}`}
      role="tablist"
      aria-label={ariaLabel}
    >
      {options.map((option) => (
        <button
          key={option.value}
          role="tab"
          aria-selected={value === option.value}
          className={`segmented-control__button ${value === option.value ? 'segmented-control__button--active' : ''}`}
          onClick={() => onChange(option.value)}
          title={iconOnly ? option.label : undefined}
          aria-label={iconOnly ? option.label : undefined}
        >
          {option.icon && <span className="segmented-control__icon">{option.icon}</span>}
          {!iconOnly && (
            <span className="segmented-control__label">
              {option.label}
              {option.count !== undefined && (
                <span className="segmented-control__count"> ({option.count})</span>
              )}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

import { useState, useRef, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronDown, faCheck } from '@fortawesome/free-solid-svg-icons';
import './MultiSelectDropdown.css';

export interface MultiSelectOption {
  value: string | number;
  label: string;
}

interface MultiSelectDropdownProps {
  label: string;
  options: MultiSelectOption[];
  selectedValues: (string | number)[];
  onChange: (selectedValues: (string | number)[]) => void;
  selectAllLabel?: string;
  placeholder?: string;
}

export function MultiSelectDropdown({
  label,
  options,
  selectedValues,
  onChange,
  selectAllLabel = 'All',
  placeholder,
}: MultiSelectDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // Check if all options are selected
  const isAllSelected = selectedValues.length === 0 || selectedValues.length === options.length;

  const handleToggleAll = () => {
    if (isAllSelected) {
      // If all selected, do nothing (keep all selected as default)
      return;
    }
    // Select all
    onChange([]);
  };

  const handleToggleOption = (value: string | number) => {
    if (selectedValues.length === 0) {
      // Currently "all" is selected, switch to selecting just this one option
      onChange([value]);
    } else if (selectedValues.includes(value)) {
      // Deselect this option
      const newSelected = selectedValues.filter(v => v !== value);
      // If nothing left selected, go back to "all"
      onChange(newSelected.length === 0 ? [] : newSelected);
    } else {
      // Add this option
      const newSelected = [...selectedValues, value];
      // If all options now selected, switch to "all"
      if (newSelected.length === options.length) {
        onChange([]);
      } else {
        onChange(newSelected);
      }
    }
  };

  const getDisplayText = () => {
    if (isAllSelected) {
      return selectAllLabel;
    }
    if (selectedValues.length === 1) {
      const option = options.find(opt => opt.value === selectedValues[0]);
      return option?.label || selectAllLabel;
    }
    return `${selectedValues.length} selected`;
  };

  return (
    <div className="multi-select-dropdown" ref={dropdownRef}>
      <label className="multi-select-label">{label}</label>
      <button
        type="button"
        className="multi-select-trigger"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        <span className="multi-select-display">{placeholder || getDisplayText()}</span>
        <FontAwesomeIcon 
          icon={faChevronDown} 
          className={`multi-select-arrow ${isOpen ? 'open' : ''}`}
        />
      </button>

      {isOpen && (
        <div className="multi-select-dropdown-menu" role="listbox">
          {/* Select All option */}
          <label className="multi-select-option">
            <input
              type="checkbox"
              checked={isAllSelected}
              onChange={handleToggleAll}
              className="multi-select-checkbox"
            />
            <span className="multi-select-checkbox-custom">
              {isAllSelected && <FontAwesomeIcon icon={faCheck} />}
            </span>
            <span className="multi-select-option-label">{selectAllLabel}</span>
          </label>

          {/* Individual options */}
          {options.map((option) => {
            const isSelected = isAllSelected || selectedValues.includes(option.value);
            return (
              <label key={option.value} className="multi-select-option">
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => handleToggleOption(option.value)}
                  className="multi-select-checkbox"
                />
                <span className="multi-select-checkbox-custom">
                  {isSelected && <FontAwesomeIcon icon={faCheck} />}
                </span>
                <span className="multi-select-option-label">{option.label}</span>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}

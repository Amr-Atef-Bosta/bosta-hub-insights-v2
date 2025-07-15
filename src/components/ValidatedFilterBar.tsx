import React, { useState, useEffect, useRef } from 'react';
import { Calendar, Filter, X, Search, ChevronDown } from 'lucide-react';
import { FilterDimension, FilterParams, validatedQueriesService } from '../services/validatedQueriesService';

interface FilterBarProps {
  filters: FilterParams;
  onFiltersChange: (filters: FilterParams) => void;
  className?: string;
}

// Searchable Select Component
interface SearchableSelectProps {
  value: string;
  onChange: (value: string | undefined) => void;
  options: any[];
  placeholder: string;
  dimension: FilterDimension;
}

const SearchableSelect: React.FC<SearchableSelectProps> = ({ 
  value, 
  onChange, 
  options, 
  placeholder, 
  dimension 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredOptions, setFilteredOptions] = useState(options);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const filtered = options.filter(option => {
      let optionText = '';
      
      if (typeof option === 'string' || typeof option === 'number') {
        optionText = String(option);
      } else if (option && typeof option === 'object') {
        const keys = Object.keys(option);
        if (keys.length === 1) {
          optionText = String(option[keys[0]]);
        } else {
          optionText = option.name || option.label || option.id || option.value || String(option);
        }
      }
      
      return optionText.toLowerCase().includes(searchTerm.toLowerCase());
    });
    setFilteredOptions(filtered);
  }, [searchTerm, options]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchTerm('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getDisplayValue = () => {
    if (!value) return placeholder;
    
    const selectedOption = options.find(option => {
      if (typeof option === 'string' || typeof option === 'number') {
        return String(option) === value;
      } else if (option && typeof option === 'object') {
        const keys = Object.keys(option);
        if (keys.length === 1) {
          return String(option[keys[0]]) === value;
        } else {
          return (option.id || option.value) === value;
        }
      }
      return false;
    });

    if (selectedOption) {
      if (typeof selectedOption === 'string' || typeof selectedOption === 'number') {
        return String(selectedOption);
      } else if (selectedOption && typeof selectedOption === 'object') {
        const keys = Object.keys(selectedOption);
        if (keys.length === 1) {
          return String(selectedOption[keys[0]]);
        } else {
          return selectedOption.name || selectedOption.label || selectedOption.id || selectedOption.value || String(selectedOption);
        }
      }
    }
    
    return value;
  };

  const handleOptionSelect = (option: any) => {
    let optionValue: string;
    
    if (typeof option === 'string' || typeof option === 'number') {
      optionValue = String(option);
    } else if (option && typeof option === 'object') {
      const keys = Object.keys(option);
      if (keys.length === 1) {
        optionValue = String(option[keys[0]]);
      } else {
        optionValue = option.id || option.value || String(option);
      }
    } else {
      optionValue = '';
    }

    onChange(optionValue || undefined);
    setIsOpen(false);
    setSearchTerm('');
  };

  const renderOption = (option: any, index: number) => {
    let optionValue: string;
    let optionText: string;
    
    if (typeof option === 'string' || typeof option === 'number') {
      optionValue = String(option);
      optionText = String(option);
    } else if (option && typeof option === 'object') {
      const keys = Object.keys(option);
      if (keys.length === 1) {
        optionValue = String(option[keys[0]]);
        optionText = String(option[keys[0]]);
      } else {
        optionValue = option.id || option.value || String(option);
        optionText = option.name || option.label || option.id || option.value || String(option);
      }
    } else {
      optionValue = '';
      optionText = 'N/A';
    }

    return (
      <div
        key={index}
        className="px-3 py-2 hover:bg-gray-100 cursor-pointer text-sm"
        onClick={() => handleOptionSelect(option)}
      >
        {optionText}
      </div>
    );
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <div
        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none bg-white cursor-pointer flex items-center justify-between"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className={`${!value ? 'text-gray-500' : 'text-gray-900'}`}>
          {getDisplayValue()}
        </span>
        <ChevronDown className={`h-4 w-4 text-gray-400 transform transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </div>
      
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-hidden">
          <div className="p-2 border-b border-gray-200">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder={`Search ${dimension.label.toLowerCase()}...`}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                autoFocus
              />
            </div>
          </div>
          
          <div className="max-h-48 overflow-y-auto">
            <div
              className="px-3 py-2 hover:bg-gray-100 cursor-pointer text-sm text-gray-500"
              onClick={() => handleOptionSelect(null)}
            >
              All {dimension.label}
            </div>
            {filteredOptions.length > 0 ? (
              filteredOptions.map((option, index) => renderOption(option, index))
            ) : (
              <div className="px-3 py-2 text-sm text-gray-500">
                No results found
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// Searchable MultiSelect Component
interface SearchableMultiSelectProps {
  value: string;
  onChange: (value: string | undefined) => void;
  options: any[];
  placeholder: string;
  dimension: FilterDimension;
}

const SearchableMultiSelect: React.FC<SearchableMultiSelectProps> = ({ 
  value, 
  onChange, 
  options, 
  placeholder, 
  dimension 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredOptions, setFilteredOptions] = useState(options);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  const selectedValues = value ? value.split(',') : [];

  useEffect(() => {
    const filtered = options.filter(option => {
      let optionText = '';
      
      if (typeof option === 'string' || typeof option === 'number') {
        optionText = String(option);
      } else if (option && typeof option === 'object') {
        const keys = Object.keys(option);
        if (keys.length === 1) {
          optionText = String(option[keys[0]]);
        } else {
          optionText = option.name || option.label || option.id || option.value || String(option);
        }
      }
      
      return optionText.toLowerCase().includes(searchTerm.toLowerCase());
    });
    setFilteredOptions(filtered);
  }, [searchTerm, options]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchTerm('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getDisplayValue = () => {
    if (selectedValues.length === 0) return placeholder;
    if (selectedValues.length === 1) {
      const selectedOption = options.find(option => {
        if (typeof option === 'string' || typeof option === 'number') {
          return String(option) === selectedValues[0];
        } else if (option && typeof option === 'object') {
          const keys = Object.keys(option);
          if (keys.length === 1) {
            return String(option[keys[0]]) === selectedValues[0];
          } else {
            return (option.id || option.value) === selectedValues[0];
          }
        }
        return false;
      });

      if (selectedOption) {
        if (typeof selectedOption === 'string' || typeof selectedOption === 'number') {
          return String(selectedOption);
        } else if (selectedOption && typeof selectedOption === 'object') {
          const keys = Object.keys(selectedOption);
          if (keys.length === 1) {
            return String(selectedOption[keys[0]]);
          } else {
            return selectedOption.name || selectedOption.label || selectedOption.id || selectedOption.value || String(selectedOption);
          }
        }
      }
      
      return selectedValues[0];
    }
    
    return `${selectedValues.length} selected`;
  };

  const handleOptionToggle = (option: any) => {
    let optionValue: string;
    
    if (typeof option === 'string' || typeof option === 'number') {
      optionValue = String(option);
    } else if (option && typeof option === 'object') {
      const keys = Object.keys(option);
      if (keys.length === 1) {
        optionValue = String(option[keys[0]]);
      } else {
        optionValue = option.id || option.value || String(option);
      }
    } else {
      optionValue = '';
    }

    const newSelectedValues = selectedValues.includes(optionValue)
      ? selectedValues.filter(v => v !== optionValue)
      : [...selectedValues, optionValue];

    onChange(newSelectedValues.length > 0 ? newSelectedValues.join(',') : undefined);
  };

  const renderOption = (option: any, index: number) => {
    let optionValue: string;
    let optionText: string;
    
    if (typeof option === 'string' || typeof option === 'number') {
      optionValue = String(option);
      optionText = String(option);
    } else if (option && typeof option === 'object') {
      const keys = Object.keys(option);
      if (keys.length === 1) {
        optionValue = String(option[keys[0]]);
        optionText = String(option[keys[0]]);
      } else {
        optionValue = option.id || option.value || String(option);
        optionText = option.name || option.label || option.id || option.value || String(option);
      }
    } else {
      optionValue = '';
      optionText = 'N/A';
    }

    const isSelected = selectedValues.includes(optionValue);

    return (
      <div
        key={index}
        className={`px-3 py-2 hover:bg-gray-100 cursor-pointer text-sm flex items-center justify-between ${isSelected ? 'bg-blue-50 text-blue-700' : ''}`}
        onClick={() => handleOptionToggle(option)}
      >
        <span>{optionText}</span>
        {isSelected && (
          <div className="w-4 h-4 bg-blue-500 rounded-sm flex items-center justify-center">
            <X className="w-3 h-3 text-white" />
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <div
        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none bg-white cursor-pointer flex items-center justify-between"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className={`${selectedValues.length === 0 ? 'text-gray-500' : 'text-gray-900'}`}>
          {getDisplayValue()}
        </span>
        <ChevronDown className={`h-4 w-4 text-gray-400 transform transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </div>
      
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-hidden">
          <div className="p-2 border-b border-gray-200">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder={`Search ${dimension.label.toLowerCase()}...`}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                autoFocus
              />
            </div>
          </div>
          
          <div className="max-h-48 overflow-y-auto">
            {selectedValues.length > 0 && (
              <div className="px-3 py-2 border-b border-gray-200">
                <button
                  onClick={() => onChange(undefined)}
                  className="text-xs text-red-600 hover:text-red-700"
                >
                  Clear all selections
                </button>
              </div>
            )}
            {filteredOptions.length > 0 ? (
              filteredOptions.map((option, index) => renderOption(option, index))
            ) : (
              <div className="px-3 py-2 text-sm text-gray-500">
                No results found
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export const ValidatedFilterBar: React.FC<FilterBarProps> = ({
  filters,
  onFiltersChange,
  className = ''
}) => {
  const [dimensions, setDimensions] = useState<FilterDimension[]>([]);
  const [filterOptions, setFilterOptions] = useState<Record<string, any[]>>({});
  const [loadingOptions, setLoadingOptions] = useState<Record<string, boolean>>({});
  const [hasSetDefaults, setHasSetDefaults] = useState(false);

  useEffect(() => {
    loadFilterDimensions();
  }, []);

  // Set default date values if filters are empty (only once)
  useEffect(() => {
    if (!hasSetDefaults && Object.keys(filters).length === 0) {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      
      onFiltersChange({
        start_date: startOfMonth.toISOString().split('T')[0],
        end_date: endOfMonth.toISOString().split('T')[0]
      });
      setHasSetDefaults(true);
    }
  }, [filters, onFiltersChange, hasSetDefaults]);

  const loadFilterDimensions = async () => {
    try {
      // First load dimensions to show filter structure immediately
      const dims = await validatedQueriesService.getFilterDimensions();
      setDimensions(dims);
      
      // Initialize loading states for all select/multiselect controls
      const initialLoadingStates: Record<string, boolean> = {};
      dims
        .filter(dim => dim.control === 'select' || dim.control === 'multiselect')
        .forEach(dim => {
          initialLoadingStates[dim.sql_param] = true;
        });
      setLoadingOptions(initialLoadingStates);
      
      // Load options in parallel for each filter (non-blocking)
      const optionsPromises = dims
        .filter(dim => dim.control === 'select' || dim.control === 'multiselect')
        .map(async dim => {
          try {
            const opts = await validatedQueriesService.getFilterOptions(dim.sql_param);
            
            // Update options and loading state for this specific filter
            setFilterOptions(prev => ({ ...prev, [dim.sql_param]: opts }));
            setLoadingOptions(prev => ({ ...prev, [dim.sql_param]: false }));
            
            return { param: dim.sql_param, opts };
          } catch (error) {
            console.warn(`Failed to load options for ${dim.sql_param}:`, error);
            
            // Set empty options and stop loading for this filter
            setFilterOptions(prev => ({ ...prev, [dim.sql_param]: [] }));
            setLoadingOptions(prev => ({ ...prev, [dim.sql_param]: false }));
            
            return { param: dim.sql_param, opts: [] };
          }
        });

      // Wait for all options to complete (for any cleanup if needed)
      await Promise.all(optionsPromises);
      
    } catch (error) {
      console.error('Failed to load filter dimensions:', error);
    }
  };

  const handleFilterChange = (param: string, value: any) => {
    const newFilters = {
      ...filters,
      [param]: value
    };
    onFiltersChange(newFilters);
  };

  const clearFilter = (param: string) => {
    const newFilters = { ...filters };
    delete newFilters[param];
    onFiltersChange(newFilters);
  };

  const clearAllFilters = () => {
    onFiltersChange({});
  };

  const renderFilterControl = (dimension: FilterDimension) => {
    const value = filters[dimension.sql_param];
    const isLoadingOptions = loadingOptions[dimension.sql_param];

    switch (dimension.control) {
      case 'date_range':
        return (
          <div className="flex flex-col space-y-2">
            <label className="text-sm font-medium text-gray-700">{dimension.label}</label>
            <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
              <div className="relative flex-1">
                <Calendar className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <input
                  type="date"
                  value={filters.start_date || ''}
                  onChange={(e) => handleFilterChange('start_date', e.target.value)}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Start Date"
                />
              </div>
              <div className="relative flex-1">
                <Calendar className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <input
                  type="date"
                  value={filters.end_date || ''}
                  onChange={(e) => handleFilterChange('end_date', e.target.value)}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="End Date"
                />
              </div>
            </div>
          </div>
        );

      case 'select':
        const options = filterOptions[dimension.sql_param] || [];
        
        // Use searchable select for merchant, region, tier, and account manager
        if (['merchant_id', 'region', 'tier', 'am'].includes(dimension.sql_param)) {
          return (
            <div className="flex flex-col space-y-2">
              <label className="text-sm font-medium text-gray-700">
                {dimension.label}
                {isLoadingOptions && (
                  <span className="ml-2 text-xs text-gray-500">(loading...)</span>
                )}
              </label>
              {isLoadingOptions ? (
                <div className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 flex items-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500 mr-2"></div>
                  <span className="text-gray-500 text-sm">Loading {dimension.label.toLowerCase()}...</span>
                </div>
              ) : (
                <SearchableSelect
                  value={value || ''}
                  onChange={(val) => handleFilterChange(dimension.sql_param, val)}
                  options={options}
                  placeholder={`All ${dimension.label}`}
                  dimension={dimension}
                />
              )}
            </div>
          );
        }

        // Regular select for other filters
        return (
          <div className="flex flex-col space-y-2">
            <label className="text-sm font-medium text-gray-700">
              {dimension.label}
              {isLoadingOptions && (
                <span className="ml-2 text-xs text-gray-500">(loading...)</span>
              )}
            </label>
            <div className="relative">
              {isLoadingOptions ? (
                <div className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 flex items-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500 mr-2"></div>
                  <span className="text-gray-500 text-sm">Loading options...</span>
                </div>
              ) : (
                <>
                  <select
                    value={value || ''}
                    onChange={(e) => handleFilterChange(dimension.sql_param, e.target.value || undefined)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none bg-white"
                  >
                    <option value="">All {dimension.label}</option>
                    {options.map((option, index) => {
                      // Handle both structured objects (merchants) and simple string values (tier, region, etc.)
                      if (typeof option === 'string' || typeof option === 'number') {
                        // Simple string/number value
                        return (
                          <option key={index} value={option}>
                            {option}
                          </option>
                        );
                      } else if (option && typeof option === 'object') {
                        // Check if it's a database row with a single column
                        const keys = Object.keys(option);
                        if (keys.length === 1) {
                          // Single column result like { tier: 'premium' }
                          const value = option[keys[0]];
                          return (
                            <option key={index} value={value}>
                              {value}
                            </option>
                          );
                        } else {
                          // Structured object with id/name properties
                          const optionValue = option.id || option.value || option;
                          const optionText = option.name || option.label || option.id || option.value || option;
                          return (
                            <option key={index} value={optionValue}>
                              {optionText}
                            </option>
                          );
                        }
                      } else {
                        // Fallback for null/undefined
                        return (
                          <option key={index} value="">
                            N/A
                          </option>
                        );
                      }
                    })}
                  </select>
                  <Filter className="absolute right-3 top-3 h-4 w-4 text-gray-400 pointer-events-none" />
                </>
              )}
            </div>
          </div>
        );

      case 'multiselect':
        // Simplified multiselect - in production you'd use a proper multiselect component
        const multiOptions = filterOptions[dimension.sql_param] || [];
        
        return (
          <div className="flex flex-col space-y-2">
            <label className="text-sm font-medium text-gray-700">
              {dimension.label}
              {isLoadingOptions && (
                <span className="ml-2 text-xs text-gray-500">(loading...)</span>
              )}
            </label>
            {isLoadingOptions ? (
              <div className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 flex items-center">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500 mr-2"></div>
                <span className="text-gray-500 text-sm">Loading {dimension.label.toLowerCase()}...</span>
              </div>
            ) : (
              <SearchableMultiSelect
                value={value || ''}
                onChange={(val) => handleFilterChange(dimension.sql_param, val)}
                options={multiOptions}
                placeholder={`All ${dimension.label}`}
                dimension={dimension}
              />
            )}
          </div>
        );

      case 'text':
        return (
          <div className="flex flex-col space-y-2">
            <label className="text-sm font-medium text-gray-700">{dimension.label}</label>
            <input
              type="text"
              value={value || ''}
              onChange={(e) => handleFilterChange(dimension.sql_param, e.target.value || undefined)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder={`Enter ${dimension.label}`}
            />
          </div>
        );

      default:
        return null;
    }
  };

  const activeFiltersCount = Object.keys(filters).length;

  // Show filters immediately - no more global loading state
  return (
    <div className={`bg-white p-6 rounded-lg border shadow-sm ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium text-gray-900">Filters</h3>
        <div className="flex items-center space-x-2">
          {activeFiltersCount > 0 && (
            <>
              <span className="text-sm text-gray-500">
                {activeFiltersCount} filter{activeFiltersCount > 1 ? 's' : ''} applied
              </span>
              <button
                onClick={clearAllFilters}
                className="flex items-center space-x-1 px-3 py-1 text-sm text-red-600 hover:text-red-700 border border-red-200 rounded-md hover:bg-red-50"
              >
                <X className="h-3 w-3" />
                <span>Clear All</span>
              </button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {dimensions.map((dimension) => (
          <div key={dimension.id} className="relative">
            {renderFilterControl(dimension)}
            {filters[dimension.sql_param] && !loadingOptions[dimension.sql_param] && (
              <button
                onClick={() => clearFilter(dimension.sql_param)}
                className="absolute top-7 right-2 p-1 text-gray-400 hover:text-gray-600"
                title={`Clear ${dimension.label}`}
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Active Filters Display */}
      {activeFiltersCount > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="flex flex-wrap gap-2">
            {Object.entries(filters).map(([key, value]) => {
              const dimension = dimensions.find(d => d.sql_param === key);
              if (!dimension || !value) return null;

              // Safely convert value to string for display
              const displayValue = (() => {
                if (typeof value === 'string' || typeof value === 'number') {
                  return String(value);
                } else if (value === null || value === undefined) {
                  return 'N/A';
                } else {
                  return String(value);
                }
              })();

              return (
                <span
                  key={key}
                  className="inline-flex items-center space-x-1 px-3 py-1 bg-blue-100 text-blue-800 text-sm rounded-full"
                >
                  <span>{dimension.label}: {displayValue}</span>
                  <button
                    onClick={() => clearFilter(key)}
                    className="text-blue-600 hover:text-blue-800"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}; 
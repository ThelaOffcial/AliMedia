import React from 'react';
import { Elephant, FilterOptions } from '../types/elephant';
import { SlidersHorizontal, X, Search, Check, Sparkles, Crown } from 'lucide-react';
import { Language, translations } from '../utils/translations';

interface FilterBarProps {
  filters: FilterOptions;
  setFilters: React.Dispatch<React.SetStateAction<FilterOptions>>;
  allElephants: Elephant[];
  language: Language;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  filters,
  setFilters,
  allElephants,
  language,
}) => {
  const t = translations[language];

  // Derive dynamic filter lists from actual data only
  const availableLocations = Array.from(
    new Set(allElephants.map((e) => e.location).filter(Boolean))
  ).sort();

  const availableOrganizations = Array.from(
    new Set(allElephants.map((e) => e.organization).filter(Boolean))
  ).sort();

  const hasActiveFilters =
    filters.type !== 'all' ||
    filters.gender !== 'all' ||
    filters.location !== 'all' ||
    filters.organization !== 'all' ||
    filters.status !== 'all' ||
    filters.verifiedOnly ||
    filters.searchQuery.trim() !== '';

  const handleResetFilters = () => {
    setFilters({
      type: 'all',
      gender: 'all',
      location: 'all',
      organization: 'all',
      status: 'all',
      verifiedOnly: false,
      searchQuery: '',
      sortBy: 'name',
    });
  };

  return (
    <div className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md rounded-3xl p-4 sm:p-5 border border-zinc-200/80 dark:border-zinc-800 shadow-sm space-y-4">
      {/* Search & Quick Pills Row */}
      <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        {/* Quick Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
          <input
            type="search"
            value={filters.searchQuery}
            onChange={(e) => setFilters((prev) => ({ ...prev, searchQuery: e.target.value }))}
            placeholder={t.searchPlaceholder}
            aria-label={t.searchPlaceholder || 'Search'}
            className="w-full pl-10 pr-9 py-2.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 rounded-2xl text-sm border border-transparent focus:border-amber-500 focus:bg-white dark:focus:bg-zinc-900 focus:outline-none transition-all"
          />
          {filters.searchQuery && (
            <button
              onClick={() => setFilters((prev) => ({ ...prev, searchQuery: '' }))}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Quick Type Selection Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
          <button
            onClick={() => setFilters((prev) => ({ ...prev, type: 'all' }))}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
              filters.type === 'all'
                ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 shadow-sm'
                : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
            }`}
          >
            {t.all}
          </button>

          <button
            onClick={() => setFilters((prev) => ({ ...prev, type: filters.type === 'tusker' ? 'all' : 'tusker' }))}
            className={`inline-flex items-center gap-1 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
              filters.type === 'tusker'
                ? 'bg-amber-500 text-amber-950 shadow-md ring-2 ring-amber-400/40 font-bold'
                : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
            }`}
          >
            <Crown className="w-3.5 h-3.5" />
            <span>{t.tuskers}</span>
          </button>

          <button
            onClick={() => setFilters((prev) => ({ ...prev, type: filters.type === 'elephant' ? 'all' : 'elephant' }))}
            className={`inline-flex items-center gap-1 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
              filters.type === 'elephant'
                ? 'bg-emerald-700 text-white shadow-md ring-2 ring-emerald-600/40 font-bold'
                : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{t.elephants}</span>
          </button>

          {/* Verified toggle */}
          <button
            onClick={() => setFilters((prev) => ({ ...prev, verifiedOnly: !prev.verifiedOnly }))}
            className={`inline-flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
              filters.verifiedOnly
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
            }`}
          >
            <Check className={`w-3.5 h-3.5 ${filters.verifiedOnly ? 'opacity-100' : 'opacity-40'}`} />
            <span>{t.verifiedOnly}</span>
          </button>
        </div>
      </div>

      {/* Advanced Filter Dropdowns Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2 border-t border-zinc-100 dark:border-zinc-800/80">
        {/* Gender Filter */}
        <div>
          <label className="block text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-1">
            {t.gender}
          </label>
          <select
            value={filters.gender}
            onChange={(e) => setFilters((prev) => ({ ...prev, gender: e.target.value }))}
            className="w-full py-2 px-3 bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 rounded-xl text-xs border border-transparent focus:border-amber-500 focus:outline-none cursor-pointer"
          >
            <option value="all">{t.all}</option>
            <option value="male">{t.male}</option>
            <option value="female">{t.female}</option>
          </select>
        </div>

        {/* Location Filter (only existing) */}
        <div>
          <label className="block text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-1">
            {t.location}
          </label>
          <select
            value={filters.location}
            onChange={(e) => setFilters((prev) => ({ ...prev, location: e.target.value }))}
            className="w-full py-2 px-3 bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 rounded-xl text-xs border border-transparent focus:border-amber-500 focus:outline-none cursor-pointer truncate"
          >
            <option value="all">{t.all}</option>
            {availableLocations.map((loc) => (
              <option key={loc} value={loc}>
                {loc}
              </option>
            ))}
          </select>
        </div>

        {/* Organization / Temple Filter (only existing) */}
        <div>
          <label className="block text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-1">
            {t.organization}
          </label>
          <select
            value={filters.organization}
            onChange={(e) => setFilters((prev) => ({ ...prev, organization: e.target.value }))}
            className="w-full py-2 px-3 bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 rounded-xl text-xs border border-transparent focus:border-amber-500 focus:outline-none cursor-pointer truncate"
          >
            <option value="all">{t.all}</option>
            {availableOrganizations.map((org) => (
              <option key={org} value={org}>
                {org}
              </option>
            ))}
          </select>
        </div>

        {/* Sort / Status */}
        <div>
          <label className="block text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-1">
            {t.status}
          </label>
          <select
            value={filters.status}
            onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value }))}
            className="w-full py-2 px-3 bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 rounded-xl text-xs border border-transparent focus:border-amber-500 focus:outline-none cursor-pointer"
          >
            <option value="all">{t.all}</option>
            <option value="living">{t.living}</option>
            <option value="memorial">{t.memorial}</option>
          </select>
        </div>
      </div>

      {/* Clear Filters Indicator */}
      {hasActiveFilters && (
        <div className="flex items-center justify-between pt-2 text-xs text-zinc-500 border-t border-zinc-100 dark:border-zinc-800">
          <span className="flex items-center gap-1.5">
            <SlidersHorizontal className="w-3.5 h-3.5 text-amber-500" />
            <span>Active filtering applied</span>
          </span>
          <button
            onClick={handleResetFilters}
            className="text-amber-600 dark:text-amber-400 hover:underline font-semibold cursor-pointer flex items-center gap-1"
          >
            <X className="w-3 h-3" />
            <span>{t.clearFilters}</span>
          </button>
        </div>
      )}
    </div>
  );
};

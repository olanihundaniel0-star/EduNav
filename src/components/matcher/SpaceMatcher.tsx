import React, { memo } from 'react';
import type { SpaceRecommendation } from '../../lib/gemini';

type SpaceMatcherProps = {
  matcherInput: string;
  onInputChange: (value: string) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onClear?: () => void;
  loading: boolean;
  error: string | null;
  recommendations: SpaceRecommendation[];
};

const SpaceMatcher = ({
  matcherInput,
  onInputChange,
  onSubmit,
  onClear,
  loading,
  error,
  recommendations,
}: SpaceMatcherProps) => {
  return (
    <section className="rounded-2xl bg-[#0A0A0A] p-6 text-white">
      <h2 className="text-xl font-semibold">What do you need right now?</h2>
      <p className="mt-1 text-sm text-gray-400">Describe your ideal study environment</p>
      <form onSubmit={onSubmit} className="mt-4 flex gap-2">
        <input
          value={matcherInput}
          onChange={(e) => onInputChange(e.target.value)}
          className="w-full rounded-xl border border-white/15 bg-black/40 px-4 py-3 text-sm text-white outline-none transition-all duration-150 focus:border-transparent focus:ring-2 focus:ring-[#4285F4]"
        />
        <button
          type="submit"
          disabled={loading}
          className="cursor-pointer rounded-xl bg-[#4285F4] px-4 py-3 text-sm font-semibold transition-colors duration-150 hover:bg-blue-600 active:bg-blue-700 disabled:opacity-50"
        >
          Send
        </button>
      </form>
      {error && <p className="mt-3 text-sm text-[#DB4437]">{error}</p>}
      
      {recommendations.length > 0 && (
        <>
          <div className="mt-6 flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-300">Suggested Spaces</h3>
            {onClear && (
              <button
                type="button"
                onClick={onClear}
                className="flex cursor-pointer items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black transition-colors duration-150 hover:bg-gray-200 active:bg-gray-300"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 12H5M12 19l-7-7 7-7"/>
                </svg>
                Back
              </button>
            )}
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {recommendations.map((item) => (
              <div key={item.name} className="rounded-xl bg-white/5 p-3">
                <p className="font-semibold">{item.name}</p>
                <p className="mt-1 text-sm text-gray-300">{item.reason}</p>
                <p className="mt-2 text-xs text-gray-400">{item.status}</p>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
};

export default memo(SpaceMatcher);

import React, { memo } from 'react';
import type { SpaceRecommendation } from '../../lib/gemini';

type SpaceMatcherProps = {
  matcherInput: string;
  onInputChange: (value: string) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  loading: boolean;
  error: string | null;
  recommendations: SpaceRecommendation[];
};

const SpaceMatcher = ({
  matcherInput,
  onInputChange,
  onSubmit,
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
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {recommendations.map((item) => (
          <div key={item.name} className="rounded-xl bg-white/5 p-3">
            <p className="font-semibold">{item.name}</p>
            <p className="mt-1 text-sm text-gray-300">{item.reason}</p>
            <p className="mt-2 text-xs text-gray-400">{item.status}</p>
          </div>
        ))}
      </div>
    </section>
  );
};

export default memo(SpaceMatcher);

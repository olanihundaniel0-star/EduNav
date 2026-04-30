import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

import { useCheckin } from '../hooks/useCheckin';
import { type AmenityKey, getAmenityStatus, useAmenityVotes } from '../hooks/useAmenityVotes';
import { useRealtime } from '../hooks/useRealtime';
import { useSpaces } from '../hooks/useSpaces';
import ReportModal from '../components/report/ReportModal';
import { matchSpaces, type SpaceRecommendation } from '../lib/gemini';
import { supabase } from '../lib/supabase';
import type { tsSpace } from '../types';

type FilterKey = 'all' | 'available' | 'main' | 'faculty' | 'ac' | 'power' | 'quiet';

type FeedItem = {
  id: string;
  spaceName: string;
  createdAt: string;
};

const filterChips: Array<{ key: FilterKey; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'available', label: 'Available Now' },
  { key: 'main', label: 'Main Libraries' },
  { key: 'faculty', label: 'Faculty Libraries' },
  { key: 'ac', label: 'Has AC' },
  { key: 'power', label: 'Has Power' },
  { key: 'quiet', label: 'Quiet' },
];

const amenityKeys: AmenityKey[] = ['ac', 'wifi', 'power', 'quiet'];

const getUtilization = (space: tsSpace) => {
  if (!space.total_capacity) return 0;
  return Math.min(100, Math.round((space.current_count / space.total_capacity) * 100));
};

const getStatus = (space: tsSpace) => {
  const utilization = getUtilization(space);
  if (utilization >= 80) return { text: 'FULL', color: 'bg-[#DB4437] text-white' };
  if (utilization >= 50) return { text: 'MODERATE', color: 'bg-[#F4B400] text-black' };
  return { text: 'OPEN', color: 'bg-[#0F9D58] text-white' };
};

const capacityColor = (pct: number) => {
  if (pct > 80) return 'bg-[#DB4437]';
  if (pct >= 50) return 'bg-[#F4B400]';
  return 'bg-[#0F9D58]';
};

const minsAgo = (iso: string) => {
  const diff = Math.max(0, Date.now() - new Date(iso).getTime());
  const mins = Math.floor(diff / 60000);
  return mins <= 1 ? '1 min ago' : `${mins} min ago`;
};

const Icon = ({ path, active }: { path: string; active?: boolean }) => (
  <svg viewBox="0 0 24 24" className={`h-5 w-5 ${active ? 'text-[#4285F4]' : 'text-black'}`} fill="none">
    <path d={path} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const ThumbIcon = ({ direction }: { direction: 'up' | 'down' }) => (
  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none">
    <path
      d={
        direction === 'up'
          ? 'M14 10V4a2 2 0 00-2-2l-1 5-3 4v9h9a2 2 0 002-1.8l1-6.2A2 2 0 0018 10h-4zM8 11H5a1 1 0 00-1 1v8a1 1 0 001 1h3'
          : 'M10 14v6a2 2 0 002 2l1-5 3-4V4H7a2 2 0 00-2 1.8L4 12a2 2 0 002 2h4zM16 13h3a1 1 0 011 1v8a1 1 0 01-1 1h-3'
      }
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

type SpaceCardWithVotesProps = {
  space: tsSpace;
  checkedIn: boolean;
  onCheckin: (spaceId: string) => Promise<void>;
};

const SpaceCardWithVotes = ({ space, checkedIn, onCheckin }: SpaceCardWithVotesProps) => {
  const { votes, userVotes, castVote } = useAmenityVotes(space.id);

  const computedAmenities = useMemo(() => {
    return amenityKeys.reduce<Record<AmenityKey, boolean>>(
      (acc, amenity) => {
        acc[amenity] = getAmenityStatus(votes, amenity, Boolean(space.amenities?.[amenity]));
        return acc;
      },
      { ac: false, wifi: false, power: false, quiet: false },
    );
  }, [space.amenities, votes]);

  const status = getStatus(space);
  const utilization = getUtilization(space);

  const handleVote = async (amenity: AmenityKey, working: boolean) => {
    try {
      await castVote(amenity, working);
    } catch {
      // Silent for now so voting remains lightweight.
    }
  };

  return (
    <article className="rounded-2xl border border-black/10 bg-white p-4">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg font-bold">{space.name}</h3>
          <p className="text-sm text-black/55">{space.location}</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${status.color}`}>{status.text}</span>
      </div>
      <div className="mt-4 h-1.5 w-full rounded-full bg-black/10">
        <div className={`h-1.5 rounded-full ${capacityColor(utilization)}`} style={{ width: `${utilization}%` }} />
      </div>
      <p className="mt-2 text-sm">
        {space.current_count} / {space.total_capacity} students
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {amenityKeys.map((amenity) => (
          <span
            key={amenity}
            className={`rounded-full border px-3 py-1 text-xs ${
              computedAmenities[amenity] ? 'border-black bg-black text-white' : 'border-gray-300 text-gray-500'
            }`}
          >
            {amenity.toUpperCase()}
          </span>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-gray-500">
        <span>Are these accurate?</span>
        {amenityKeys.map((amenity) => (
          <div key={`vote-${amenity}`} className="flex items-center gap-0.5">
            <span className="text-[10px] uppercase tracking-wide text-gray-400">{amenity}</span>
            <button
              type="button"
              onClick={() => void handleVote(amenity, true)}
              className={`p-0.5 transition ${
                userVotes[amenity] === true ? 'text-[#4285F4]' : 'text-gray-400 hover:text-[#4285F4]'
              }`}
              aria-label={`Mark ${amenity.toUpperCase()} as working`}
            >
              <ThumbIcon direction="up" />
            </button>
            <button
              type="button"
              onClick={() => void handleVote(amenity, false)}
              className={`p-0.5 transition ${
                userVotes[amenity] === false ? 'text-[#DB4437]' : 'text-gray-400 hover:text-[#DB4437]'
              }`}
              aria-label={`Mark ${amenity.toUpperCase()} as not working`}
            >
              <ThumbIcon direction="down" />
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={() => void onCheckin(space.id)}
        className={`mt-4 rounded-lg px-4 py-2 text-sm font-semibold ${
          checkedIn ? 'border border-black bg-white text-black' : 'bg-[#4285F4] text-white'
        }`}
      >
        {checkedIn ? 'Check Out' : 'Check In'}
      </button>
    </article>
  );
};

export default function Dashboard() {
  const location = useLocation();
  const { spaces, setSpaces, loading } = useSpaces();
  const { checkedInBySpace, toggleCheckin } = useCheckin();
  const [sessionAvatar, setSessionAvatar] = useState<string | null>(null);
  const [activeChip, setActiveChip] = useState<FilterKey>('all');
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [activeCount, setActiveCount] = useState(0);
  const [matcherInput, setMatcherInput] = useState('');
  const [recommendations, setRecommendations] = useState<SpaceRecommendation[]>([]);
  const [matcherLoading, setMatcherLoading] = useState(false);
  const [matcherError, setMatcherError] = useState<string | null>(null);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);

  const fetchAvatar = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const user = session?.user;
    const avatar =
      (user?.user_metadata?.avatar_url as string | undefined) ??
      (user?.user_metadata?.picture as string | undefined) ??
      null;
    setSessionAvatar(avatar);
  }, []);

  const fetchFeedAndCount = useCallback(async () => {
    const { data, error } = await supabase
      .from('checkins')
      .select('id,space_id,type,created_at,user_id')
      .order('created_at', { ascending: false })
      .limit(200);

    if (error || !data) return;

    const spaceMap = new Map(spaces.map((s) => [s.id, s.name]));
    const latestBySpace = data.filter((row) => row.type === 'in').slice(0, 5);
    const nextFeed = latestBySpace.map((row) => ({
      id: row.id as string,
      spaceName: spaceMap.get(row.space_id as string) ?? 'Unknown Space',
      createdAt: row.created_at as string,
    }));

    const latestByUser = new Map<string, 'in' | 'out'>();
    for (const row of data) {
      const userId = row.user_id as string;
      if (!latestByUser.has(userId)) {
        latestByUser.set(userId, row.type as 'in' | 'out');
      }
    }
    const count = Array.from(latestByUser.values()).filter((v) => v === 'in').length;

    setFeed(nextFeed);
    setActiveCount(count);
  }, [spaces]);

  useEffect(() => {
    void fetchAvatar();
  }, [fetchAvatar]);

  useEffect(() => {
    void fetchFeedAndCount();
  }, [fetchFeedAndCount]);

  const onSpacesChange = useCallback((payload: { eventType: string; new: Record<string, unknown> }) => {
    const space = payload.new as unknown as tsSpace;
    setSpaces((prev) => {
      if (payload.eventType === 'INSERT') return [...prev, space];
      if (payload.eventType === 'UPDATE') return prev.map((s) => (s.id === space.id ? { ...s, ...space } : s));
      if (payload.eventType === 'DELETE') return prev.filter((s) => s.id !== (payload.new.id as string));
      return prev;
    });
  }, [setSpaces]);

  const onCheckinChange = useCallback(() => {
    void fetchFeedAndCount();
  }, [fetchFeedAndCount]);

  useRealtime({ table: 'spaces', onChange: onSpacesChange });
  useRealtime({ table: 'checkins', onChange: onCheckinChange });

  const filteredSpaces = useMemo(() => {
    return spaces.filter((space) => {
      if (activeChip === 'available') return getUtilization(space) < 80;
      if (activeChip === 'main') return space.name.toLowerCase().includes('main library');
      if (activeChip === 'faculty') return space.name.toLowerCase().includes('faculty');
      if (activeChip === 'ac') return Boolean(space.amenities?.ac);
      if (activeChip === 'power') return Boolean(space.amenities?.power);
      if (activeChip === 'quiet') return Boolean(space.amenities?.quiet);
      return true;
    });
  }, [activeChip, spaces]);

  const submitMatcher = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!matcherInput.trim()) return;

    setMatcherLoading(true);
    setMatcherError(null);
    try {
      const result = await matchSpaces(matcherInput.trim(), spaces);
      setRecommendations(result);
    } catch (error) {
      setMatcherError(error instanceof Error ? error.message : 'Unable to get recommendations.');
    } finally {
      setMatcherLoading(false);
    }
  };

  const handleCheckin = async (spaceId: string) => {
    try {
      await toggleCheckin(spaceId);
    } catch {
      // Intentionally silent for now to keep UI lightweight.
    }
  };

  const desktopNav = [
    { to: '/dashboard', icon: 'M3 12l9-9 9 9M5 10v10h14V10', active: location.pathname === '/dashboard' },
    { to: '#search', icon: 'M11 19a8 8 0 100-16 8 8 0 000 16zM21 21l-4.3-4.3', active: false },
    { to: '/profile', icon: 'M20 21a8 8 0 10-16 0M12 11a4 4 0 100-8 4 4 0 000 8', active: location.pathname === '/profile' },
    { to: '#report', icon: 'M12 9v4m0 4h.01M4.93 19h14.14a2 2 0 001.73-3l-7.07-12a2 2 0 00-3.46 0l-7.07 12a2 2 0 001.73 3z', active: false },
  ];

  const mobileNav = [
    'M3 12l9-9 9 9M5 10v10h14V10',
    'M11 19a8 8 0 100-16 8 8 0 000 16zM21 21l-4.3-4.3',
    'M12 5v14M5 12h14',
    'M12 9v4m0 4h.01M4.93 19h14.14a2 2 0 001.73-3l-7.07-12a2 2 0 00-3.46 0l-7.07 12a2 2 0 001.73 3z',
    'M20 21a8 8 0 10-16 0M12 11a4 4 0 100-8 4 4 0 000 8',
  ];

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-black">
      <aside className="fixed left-0 top-0 hidden h-screen w-20 flex-col items-center border-r border-gray-100 bg-[#FAFAFA] py-6 lg:flex">
        <div className="mb-12 text-lg font-bold tracking-tight">EduNav</div>
        <nav className="flex flex-1 flex-col gap-4">
          {desktopNav.map((item) => {
            if (item.to === '#report') {
              return (
                <button
                  key={item.to}
                  type="button"
                  onClick={() => setIsReportModalOpen(true)}
                  className="rounded-lg border-l-4 border-transparent px-3 py-3"
                >
                  <Icon path={item.icon} active={isReportModalOpen} />
                </button>
              );
            }

            return (
              <Link
                key={item.to}
                to={item.to}
                className={`rounded-lg border-l-4 px-3 py-3 ${item.active ? 'border-[#4285F4] bg-[#4285F4]/10' : 'border-transparent'}`}
              >
                <Icon path={item.icon} active={item.active} />
              </Link>
            );
          })}
        </nav>
        <div className="h-10 w-10 overflow-hidden rounded-full bg-black/10">
          {sessionAvatar && <img src={sessionAvatar} alt="student avatar" className="h-full w-full object-cover" />}
        </div>
      </aside>

      <main className="pb-24 lg:ml-20">
        <div className="sticky top-0 z-20 border-b border-black/10 bg-[#FAFAFA]/95 backdrop-blur">
          <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-4 lg:px-8">
            <div className="text-lg font-bold lg:hidden">EduNav</div>
            <input
              id="search"
              placeholder="Search spaces or faculties…"
              className="w-full rounded-full border border-black/15 bg-white px-4 py-2 text-sm outline-none focus:border-[#4285F4]"
            />
            <div className="hidden items-center gap-3 sm:flex">
              <div className="flex items-center gap-2 text-xs">
                <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-[#0F9D58]" />
                <span>{activeCount} students active now</span>
              </div>
              <button type="button" className="rounded-full border border-black/15 p-2">
                <Icon path="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 10-12 0v3.2a2 2 0 01-.6 1.4L4 17h5m6 0a3 3 0 11-6 0" />
              </button>
              <div className="h-8 w-8 overflow-hidden rounded-full bg-black/10">
                {sessionAvatar && (
                  <img src={sessionAvatar} alt="student avatar" className="h-full w-full object-cover" />
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 lg:px-8">
          <section className="rounded-2xl bg-[#0A0A0A] p-6 text-white">
            <h2 className="text-xl font-semibold">What do you need right now?</h2>
            <p className="mt-1 text-sm text-gray-400">Describe your ideal study environment</p>
            <form onSubmit={submitMatcher} className="mt-4 flex gap-2">
              <input
                value={matcherInput}
                onChange={(e) => setMatcherInput(e.target.value)}
                className="w-full rounded-xl border border-white/15 bg-black/40 px-4 py-3 text-sm text-white outline-none focus:border-[#4285F4]"
              />
              <button
                type="submit"
                disabled={matcherLoading}
                className="rounded-xl bg-[#4285F4] px-4 py-3 text-sm font-semibold disabled:opacity-50"
              >
                Send
              </button>
            </form>
            {matcherError && <p className="mt-3 text-sm text-[#DB4437]">{matcherError}</p>}
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

          <section className="overflow-x-auto">
            <div className="flex min-w-max gap-2 pb-1">
              {filterChips.map((chip) => (
                <button
                  key={chip.key}
                  type="button"
                  onClick={() => setActiveChip(chip.key)}
                  className={`rounded-full border px-4 py-2 text-sm ${
                    activeChip === chip.key ? 'border-black bg-black text-white' : 'border-black/20 bg-white text-black'
                  }`}
                >
                  {chip.label}
                </button>
              ))}
            </div>
          </section>

          <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {!loading &&
              filteredSpaces.map((space) => (
                <SpaceCardWithVotes
                  key={space.id}
                  space={space}
                  checkedIn={Boolean(checkedInBySpace[space.id])}
                  onCheckin={handleCheckin}
                />
              ))}
          </section>

          <section id="report" className="rounded-2xl border border-black/10 bg-white p-4">
            <h3 className="text-lg font-bold">Live Feed</h3>
            <div className="mt-3 flex flex-wrap gap-2">
              {feed.map((item) => (
                <span key={item.id} className="rounded-full bg-black px-3 py-1 text-xs text-white">
                  Someone checked into {item.spaceName} · {minsAgo(item.createdAt)}
                </span>
              ))}
            </div>
          </section>
        </div>
      </main>

      <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-black/10 bg-white p-2 lg:hidden">
        <div className="mx-auto flex max-w-md items-center justify-between">
          {mobileNav.map((path, index) => {
            if (index === 2) {
              return (
                <button
                  key={path}
                  type="button"
                  className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-[#4285F4] ring-2 ring-white"
                  aria-label="Quick check-in"
                >
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none">
                    <path d="M12 5v14M5 12h14" stroke="white" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </button>
              );
            }

            return (
              <button
                key={path}
                type="button"
                onClick={index === 3 ? () => setIsReportModalOpen(true) : undefined}
                className={`rounded-lg p-3 ${index === 0 || (index === 3 && isReportModalOpen) ? 'bg-[#4285F4]/10' : ''}`}
              >
                <Icon path={path} active={index === 0 || (index === 3 && isReportModalOpen)} />
              </button>
            );
          })}
        </div>
      </nav>

      <ReportModal isOpen={isReportModalOpen} onClose={() => setIsReportModalOpen(false)} />
    </div>
  );
}


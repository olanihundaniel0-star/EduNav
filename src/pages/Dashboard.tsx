import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { MessageCircle } from 'lucide-react';

import { useCheckin } from '../hooks/useCheckin';
import { useRealtime } from '../hooks/useRealtime';
import { useSpaces } from '../hooks/useSpaces';
import BackButton from '../components/ui/BackButton';
import Dock from '../components/ui/Dock';
import Logo from '../components/ui/Logo';
import ReportModal from '../components/report/ReportModal';
import { matchSpaces, type SpaceRecommendation } from '../lib/gemini';
import { getSpaceStatus } from '../lib/utils';
import { supabase } from '../lib/supabase';
import type { tsSpace } from '../types';

import LiveFeed, { type FeedItem } from '../components/feed/LiveFeed';
import SpaceCard from '../components/spaces/SpaceCard';
import SpaceMatcher from '../components/matcher/SpaceMatcher';

type FilterKey = 'all' | 'available' | 'main' | 'faculty' | 'power' | 'quiet';

const filterChips: Array<{ key: FilterKey; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'available', label: 'Available Now' },
  { key: 'main', label: 'Main Libraries' },
  { key: 'faculty', label: 'Faculty Libraries' },
  { key: 'power', label: 'Has Power' },
  { key: 'quiet', label: 'Quiet' },
];

const Icon = ({ path, active }: { path: string; active?: boolean }) => (
  <svg viewBox="0 0 24 24" className={`h-5 w-5 ${active ? 'text-[#4285F4]' : 'text-black'}`} fill="none">
    <path d={path} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const filterBarVariants = {
  closed: ({ width }: { width: number }) => ({ width }),
  open: ({ width }: { width: number }) => ({ width: width + 6 }),
};

const FilterToggleIcon = ({ open }: { open: boolean }) => {
  const barWidths = [24, 18, 12];

  return (
    <div className="flex flex-col items-start gap-1">
      {barWidths.map((width, index) => {
        const staggerIndex = open ? index : barWidths.length - 1 - index;
        return (
          <motion.span
            key={width}
            custom={{ width }}
            variants={filterBarVariants}
            animate={open ? 'open' : 'closed'}
            transition={{
              type: 'spring',
              stiffness: 240,
              damping: 24,
              mass: 0.7,
              delay: staggerIndex * 0.04,
            }}
            className="block h-0.5 rounded-full bg-current"
          />
        );
      })}
    </div>
  );
};

const PlusIcon = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none">
    <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

export default function Dashboard() {
  const location = useLocation();
  const navigate = useNavigate();
  const { spaces, setSpaces, loading } = useSpaces();
  const { checkedInBySpace, toggleCheckin } = useCheckin();
  const [activeChip, setActiveChip] = useState<FilterKey>('all');
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [matcherInput, setMatcherInput] = useState('');
  const [recommendations, setRecommendations] = useState<SpaceRecommendation[]>([]);
  const [matcherLoading, setMatcherLoading] = useState(false);
  const [matcherError, setMatcherError] = useState<string | null>(null);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());

  const fetchFeed = useCallback(async () => {
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

    setFeed(nextFeed);
  }, [spaces]);

  useEffect(() => {
    void fetchFeed();
  }, [fetchFeed]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

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
    void fetchFeed();
  }, [fetchFeed]);

  const filteredSpaces = useMemo(() => {
    return spaces.filter((space) => {
      if (activeChip === 'available') return getSpaceStatus(space).label !== 'BUSY';
      if (activeChip === 'main') return space.name.toLowerCase().includes('main library');
      if (activeChip === 'faculty') return space.name.toLowerCase().includes('faculty');
      if (activeChip === 'power') return Boolean(space.amenities?.power);
      if (activeChip === 'quiet') return Boolean(space.amenities?.quiet);
      return true;
    });
  }, [activeChip, spaces]);

  const renderedSpaceIds = useMemo(() => filteredSpaces.map((s) => s.id), [filteredSpaces]);

  useRealtime({ table: 'spaces', filterIds: renderedSpaceIds, onChange: onSpacesChange });
  useRealtime({ table: 'checkins', onChange: onCheckinChange });

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

  const handleQuickCheckin = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const filterPanelId = 'dashboard-filters';

  const renderFilterChips = () => (
    <div className="flex min-w-max gap-2 pb-1">
      {filterChips.map((chip) => (
        <button
          key={chip.key}
          type="button"
          onClick={() => setActiveChip(chip.key)}
          className={`cursor-pointer rounded-full border px-4 py-2 text-sm transition-colors duration-150 ${
            activeChip === chip.key
              ? 'border-black bg-black text-white'
              : 'border-black/20 bg-white text-black hover:border-black/40 hover:bg-gray-100'
          }`}
        >
          {chip.label}
        </button>
      ))}
    </div>
  );

  const desktopNav = [
    { to: '/dashboard', icon: 'M3 12l9-9 9 9M5 10v10h14V10', active: location.pathname === '/dashboard', disabled: false },
    { to: '/profile', icon: 'M20 21a8 8 0 10-16 0M12 11a4 4 0 100-8 4 4 0 000 8', active: location.pathname === '/profile', disabled: false },
    { to: '#chat', icon: '', active: false, disabled: true },
    { to: '#report', icon: 'M12 9v4m0 4h.01M4.93 19h14.14a2 2 0 001.73-3l-7.07-12a2 2 0 00-3.46 0l-7.07 12a2 2 0 001.73 3z', active: false, disabled: false },
  ];

  const dockItems = [
    {
      icon: <Icon path="M3 12l9-9 9 9M5 10v10h14V10" active={location.pathname === '/dashboard'} />,
      label: 'Home',
      onClick: () => navigate('/dashboard'),
      className: location.pathname === '/dashboard' ? 'dock-item-active' : '',
    },
    {
      icon: <PlusIcon />,
      label: 'Check in',
      onClick: handleQuickCheckin,
      className: 'dock-item-accent',
    },
    {
      icon: (
        <Icon
          path="M12 9v4m0 4h.01M4.93 19h14.14a2 2 0 001.73-3l-7.07-12a2 2 0 00-3.46 0l-7.07 12a2 2 0 001.73 3z"
          active={isReportModalOpen}
        />
      ),
      label: 'Report',
      onClick: () => setIsReportModalOpen(true),
      className: isReportModalOpen ? 'dock-item-active' : '',
    },
    {
      icon: <MessageCircle className="h-5 w-5 text-gray-300" />,
      label: 'Messages',
      onClick: () => {},
      className: 'opacity-50 cursor-not-allowed',
    },
    {
      icon: (
        <Icon
          path="M20 21a8 8 0 10-16 0M12 11a4 4 0 100-8 4 4 0 000 8"
          active={location.pathname === '/profile'}
        />
      ),
      label: 'Profile',
      onClick: () => navigate('/profile'),
      className: location.pathname === '/profile' ? 'dock-item-active' : '',
    },
  ];

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-black">
      <aside className="fixed left-0 top-0 hidden h-screen w-20 flex-col items-center border-r border-gray-100 bg-[#FAFAFA] py-6 lg:flex">
        <div className="mb-12 flex h-10 w-10 items-center justify-center">
          <Logo className="h-9 w-9 text-black" />
        </div>
        <nav className="flex flex-1 flex-col gap-4">
          {desktopNav.map((item) => {
            if (item.to === '#chat') {
              return (
                <div key={item.to} className="group relative">
                  <div className="cursor-not-allowed rounded-lg border-l-4 border-transparent px-3 py-3 opacity-50">
                    <MessageCircle className="h-5 w-5 text-gray-300" />
                  </div>
                  <div className="invisible absolute left-full top-1/2 ml-3 -translate-y-1/2 whitespace-nowrap rounded-md bg-gray-800 px-2 py-1 text-xs text-white group-hover:visible">
                    Coming soon
                  </div>
                </div>
              );
            }

            if (item.to === '#report') {
              return (
                <button
                  key={item.to}
                  type="button"
                  onClick={() => setIsReportModalOpen(true)}
                  className="cursor-pointer rounded-lg border-l-4 border-transparent px-3 py-3 transition-all duration-150 hover:bg-gray-100"
                >
                  <Icon path={item.icon} active={isReportModalOpen} />
                </button>
              );
            }

            return (
              <Link
                key={item.to}
                to={item.to}
                className={`rounded-lg border-l-4 px-3 py-3 transition-all duration-150 ${item.active ? 'border-[#4285F4] bg-[#4285F4]/10' : 'border-transparent hover:bg-gray-100'}`}
              >
                <Icon path={item.icon} active={item.active} />
              </Link>
            );
          })}
        </nav>
      </aside>

      <main className="pb-24 lg:ml-20">
        <div className="sticky top-0 z-20 border-b border-black/10 bg-[#FAFAFA]/95 backdrop-blur">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 lg:px-8">
            <div className="h-9 w-9" />
            <Logo className="h-8 w-8 text-black lg:hidden" />
            <BackButton fallbackTo="/" />
          </div>
        </div>

        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 lg:px-8">
          <SpaceMatcher
            matcherInput={matcherInput}
            onInputChange={setMatcherInput}
            onSubmit={submitMatcher}
            loading={matcherLoading}
            error={matcherError}
            recommendations={recommendations}
          />

          <section>
            <div className="flex items-center justify-between md:hidden">
              <motion.button
                type="button"
                onClick={() => setFiltersOpen((prev) => !prev)}
                whileTap={{ scale: 0.96 }}
                className={`flex h-10 w-10 items-center justify-center rounded-full border transition ${
                  filtersOpen
                    ? 'border-black bg-black text-white'
                    : 'border-black/20 bg-white text-black'
                }`}
                aria-label="Toggle filters"
                aria-expanded={filtersOpen}
                aria-controls={filterPanelId}
              >
                <FilterToggleIcon open={filtersOpen} />
              </motion.button>
            </div>

            <AnimatePresence initial={false}>
              {filtersOpen && (
                <motion.div
                  key="filters"
                  id={filterPanelId}
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25, ease: 'easeOut' }}
                  className="mt-3 overflow-hidden md:hidden"
                >
                  <div className="overflow-x-auto">{renderFilterChips()}</div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="hidden overflow-x-auto md:block">{renderFilterChips()}</div>
          </section>

          <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {!loading &&
              filteredSpaces.map((space) => (
                <SpaceCard
                  key={space.id}
                  space={space}
                  checkedIn={Boolean(checkedInBySpace[space.id])}
                  onCheckin={handleCheckin}
                />
              ))}
          </section>

          <LiveFeed feed={feed} nowMs={nowMs} />
        </div>
      </main>

      <div className="lg:hidden">
        <Dock items={dockItems} panelHeight={68} baseItemSize={50} magnification={70} />
      </div>

      <ReportModal isOpen={isReportModalOpen} onClose={() => setIsReportModalOpen(false)} />
    </div>
  );
}

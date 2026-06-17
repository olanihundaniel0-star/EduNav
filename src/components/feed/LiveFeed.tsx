import { memo } from 'react';

export type FeedItem = {
  id: string;
  spaceName: string;
  createdAt: string;
};

type LiveFeedProps = {
  feed: FeedItem[];
  nowMs: number;
};

const relativeTime = (iso: string, nowMs: number) => {
  const createdAtMs = new Date(iso).getTime();
  if (Number.isNaN(createdAtMs)) return 'just now';

  const diffSeconds = Math.max(0, Math.floor((nowMs - createdAtMs) / 1000));

  if (diffSeconds < 5) return 'just now';
  if (diffSeconds < 60) return diffSeconds === 1 ? '1 second ago' : `${diffSeconds} seconds ago`;

  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return diffMinutes === 1 ? '1 minute ago' : `${diffMinutes} minutes ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return diffHours === 1 ? '1 hour ago' : `${diffHours} hours ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return diffDays === 1 ? '1 day ago' : `${diffDays} days ago`;

  const diffWeeks = Math.floor(diffDays / 7);
  if (diffWeeks < 5) return diffWeeks === 1 ? '1 week ago' : `${diffWeeks} weeks ago`;

  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths < 12) return diffMonths === 1 ? '1 month ago' : `${diffMonths} months ago`;

  const diffYears = Math.floor(diffDays / 365);
  return diffYears === 1 ? '1 year ago' : `${diffYears} years ago`;
};

const LiveFeed = ({ feed, nowMs }: LiveFeedProps) => {
  return (
    <section id="report" className="rounded-2xl border border-black/10 bg-white p-4">
      <h3 className="text-lg font-bold">Live Feed</h3>
      <div className="mt-3 flex flex-wrap gap-2">
        {feed.map((item) => (
          <span key={item.id} className="rounded-full bg-black px-3 py-1 text-xs text-white">
            Someone checked into {item.spaceName} {'\u00b7'} {relativeTime(item.createdAt, nowMs)}
          </span>
        ))}
      </div>
    </section>
  );
};

export default memo(LiveFeed);
// force push

import { useEffect, useMemo, useState } from 'react';
import type { User } from '@supabase/supabase-js';

import BackButton from '../components/ui/BackButton';
import { supabase } from '../lib/supabase';

type ProfileRow = {
  full_name: string | null;
  matric_no: string | null;
  faculty: string | null;
  avatar_url: string | null;
};

type JoinedSpace = {
  name: string | null;
};

type CheckinHistoryRow = {
  id: string;
  type: 'in' | 'out';
  created_at: string;
  spaces: JoinedSpace | JoinedSpace[] | null;
};

type ReportHistoryRow = {
  id: string;
  issue_type: string | null;
  created_at: string;
  spaces: JoinedSpace | JoinedSpace[] | null;
};

const getSpaceName = (value: JoinedSpace | JoinedSpace[] | null): string => {
  if (!value) return 'Unknown space';
  if (Array.isArray(value)) {
    return value[0]?.name ?? 'Unknown space';
  }
  return value.name ?? 'Unknown space';
};

const formatTimestamp = (iso: string): string => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return 'Unknown time';
  }
  return date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

const formatIssueType = (issueType: string | null): string => {
  if (!issueType) {
    return 'other';
  }

  return issueType
    .split('_')
    .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : part))
    .join(' ');
};

const getNameFromUser = (user: User | null, profile: ProfileRow | null): string => {
  if (profile?.full_name?.trim()) {
    return profile.full_name;
  }

  if (!user) {
    return 'Student';
  }

  const metadata = user.user_metadata as Record<string, unknown>;
  const fullName = typeof metadata.full_name === 'string' ? metadata.full_name : null;
  const name = typeof metadata.name === 'string' ? metadata.name : null;
  return fullName ?? name ?? 'Student';
};

const getAvatarFromUser = (user: User | null, profile: ProfileRow | null): string | null => {
  if (profile?.avatar_url?.trim()) {
    return profile.avatar_url;
  }

  if (!user) {
    return null;
  }

  const metadata = user.user_metadata as Record<string, unknown>;
  const avatarUrl = typeof metadata.avatar_url === 'string' ? metadata.avatar_url : null;
  const picture = typeof metadata.picture === 'string' ? metadata.picture : null;
  return avatarUrl ?? picture ?? null;
};

export default function Profile() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [checkins, setCheckins] = useState<CheckinHistoryRow[]>([]);
  const [reports, setReports] = useState<ReportHistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditingDetails, setIsEditingDetails] = useState(false);
  const [facultyInput, setFacultyInput] = useState('');
  const [matricInput, setMatricInput] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    let active = true;

    const loadProfilePage = async () => {
      setLoading(true);

      const {
        data: { user: currentUser },
      } = await supabase.auth.getUser();

      if (!active) {
        return;
      }

      if (!currentUser) {
        setUser(null);
        setProfile(null);
        setCheckins([]);
        setReports([]);
        setLoading(false);
        return;
      }

      setUser(currentUser);

      await new Promise((resolve) => setTimeout(resolve, 300));
      if (!active) {
        return;
      }

      const profileResult = await supabase
        .from('profiles')
        .select('full_name,matric_no,faculty,avatar_url')
        .eq('id', currentUser.id)
        .maybeSingle();

      if (!active) {
        return;
      }

      const checkinsResult = await supabase
        .from('checkins')
        .select('id,type,created_at,spaces(name)')
        .eq('user_id', currentUser.id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (!active) {
        return;
      }

      const reportsResult = await supabase
        .from('reports')
        .select('id,issue_type,created_at,spaces(name)')
        .eq('user_id', currentUser.id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (!active) {
        return;
      }

      if (!profileResult.error) {
        const nextProfile = (profileResult.data as ProfileRow | null) ?? null;
        setProfile(nextProfile);
        setFacultyInput(nextProfile?.faculty ?? '');
        setMatricInput(nextProfile?.matric_no ?? '');
      }

      if (!checkinsResult.error) {
        setCheckins((checkinsResult.data as CheckinHistoryRow[] | null) ?? []);
      }

      if (!reportsResult.error) {
        setReports((reportsResult.data as ReportHistoryRow[] | null) ?? []);
      }

      setLoading(false);
    };

    void loadProfilePage();

    return () => {
      active = false;
    };
  }, []);

  const displayName = useMemo(() => getNameFromUser(user, profile), [user, profile]);
  const displayAvatar = useMemo(() => getAvatarFromUser(user, profile), [user, profile]);
  const displayEmail = user?.email ?? '';
  const faculty = profile?.faculty?.trim() ?? '';
  const matricNo = profile?.matric_no?.trim() ?? '';
  const needsDetails = !faculty || !matricNo;

  const handleSaveDetails = async () => {
    if (!user || isSaving) {
      return;
    }

    setIsSaving(true);
    const { error } = await supabase.from('profiles').upsert(
      {
        id: user.id,
        full_name: profile?.full_name ?? displayName,
        avatar_url: profile?.avatar_url ?? displayAvatar,
        faculty: facultyInput.trim() || null,
        matric_no: matricInput.trim() || null,
      },
      { onConflict: 'id' },
    );

    if (!error) {
      setProfile((prev) => ({
        full_name: prev?.full_name ?? displayName,
        avatar_url: prev?.avatar_url ?? displayAvatar,
        faculty: facultyInput.trim() || null,
        matric_no: matricInput.trim() || null,
      }));
      setIsEditingDetails(false);
    }

    setIsSaving(false);
  };

  const handleLogout = async () => {
    if (isLoggingOut) {
      return;
    }

    setIsLoggingOut(true);
    const { error } = await supabase.auth.signOut();

    if (error) {
      setIsLoggingOut(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAFAFA] px-4 py-10 text-black">
      <main className="mx-auto max-w-[700px]">
        <div className="mb-6 flex justify-end">
          <BackButton fallbackTo="/dashboard" />
        </div>

        <section className="flex flex-col items-center text-center">
          <div className="h-[60px] w-[60px] overflow-hidden rounded-full bg-gray-200">
            {displayAvatar && <img src={displayAvatar} alt="profile avatar" className="h-full w-full object-cover" />}
          </div>
          <h1 className="mt-4 text-3xl font-bold">{displayName}</h1>
          <p className="mt-1 text-sm text-gray-500">{displayEmail}</p>

          <div className="mt-6 w-full max-w-md space-y-2 text-left">
            <div className="flex items-center justify-between rounded-lg border border-gray-100 bg-white px-3 py-2">
              <span className="text-sm text-gray-500">Faculty</span>
              <span className="text-sm font-medium text-black">{faculty || 'Not set'}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-gray-100 bg-white px-3 py-2">
              <span className="text-sm text-gray-500">Matric No</span>
              <span className="text-sm font-medium text-black">{matricNo || 'Not set'}</span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => void handleLogout()}
            disabled={isLoggingOut}
            className="mt-5 cursor-pointer rounded-full border border-[#DB4437]/40 px-4 py-1.5 text-xs font-medium text-[#DB4437] transition-colors duration-150 hover:border-[#DB4437] hover:bg-[#DB4437]/10 disabled:opacity-60"
          >
            {isLoggingOut ? 'Logging out...' : 'Log out'}
          </button>

          {!isEditingDetails && needsDetails && (
            <button
              type="button"
              onClick={() => setIsEditingDetails(true)}
              className="mt-3 cursor-pointer text-xs font-medium text-[#4285F4] transition-colors duration-150 hover:text-blue-700"
            >
              Edit
            </button>
          )}

          {isEditingDetails && (
            <div className="mt-4 w-full max-w-md rounded-xl border border-gray-100 bg-white p-4 text-left">
              <div className="space-y-3">
                <input
                  type="text"
                  value={facultyInput}
                  onChange={(event) => setFacultyInput(event.target.value)}
                  placeholder="Faculty"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none transition-all duration-150 focus:border-transparent focus:ring-2 focus:ring-[#4285F4]"
                />
                <input
                  type="text"
                  value={matricInput}
                  onChange={(event) => setMatricInput(event.target.value)}
                  placeholder="Matric No"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none transition-all duration-150 focus:border-transparent focus:ring-2 focus:ring-[#4285F4]"
                />
                <button
                  type="button"
                  onClick={() => void handleSaveDetails()}
                  disabled={isSaving}
                  className="cursor-pointer rounded-full bg-black px-4 py-1.5 text-xs font-medium text-white transition-colors duration-150 hover:bg-gray-800 active:bg-gray-900 disabled:opacity-60"
                >
                  {isSaving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          )}
        </section>

        <section className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2">
          <article className="rounded-xl border border-gray-100 bg-white p-6">
            <h2 className="text-base font-semibold">Check-in History</h2>
            {loading ? (
              <p className="mt-4 text-sm text-gray-400">Loading...</p>
            ) : checkins.length === 0 ? (
              <p className="mt-4 text-sm text-gray-400">No check-ins yet</p>
            ) : (
              <ul className="mt-4 space-y-3">
                {checkins.map((item) => (
                  <li key={item.id} className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-black">{getSpaceName(item.spaces)}</p>
                      <p className="text-xs text-gray-500">{formatTimestamp(item.created_at)}</p>
                    </div>
                    <span
                      className={`rounded-full px-2.5 py-1 text-[11px] font-medium capitalize ${
                        item.type === 'in' ? 'bg-[#E8F0FE] text-[#1A73E8]' : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {item.type}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </article>

          <article className="rounded-xl border border-gray-100 bg-white p-6">
            <h2 className="text-base font-semibold">Reports Submitted</h2>
            {loading ? (
              <p className="mt-4 text-sm text-gray-400">Loading...</p>
            ) : reports.length === 0 ? (
              <p className="mt-4 text-sm text-gray-400">No reports yet</p>
            ) : (
              <ul className="mt-4 space-y-3">
                {reports.map((item) => (
                  <li key={item.id} className="space-y-1">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-semibold text-black">{getSpaceName(item.spaces)}</p>
                      <span className="rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-medium text-gray-700">
                        {formatIssueType(item.issue_type)}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500">{formatTimestamp(item.created_at)}</p>
                  </li>
                ))}
              </ul>
            )}
          </article>
        </section>
      </main>
    </div>
  );
}

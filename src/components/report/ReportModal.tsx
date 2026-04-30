import { useEffect, useMemo, useState, type ChangeEvent } from 'react';

import { supabase } from '../../lib/supabase';

type ReportModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

type SpaceOption = {
  id: string;
  name: string;
};

type IssueType = 'no_power' | 'dirty' | 'locked' | 'overcrowded' | 'other';

const issueTypes: IssueType[] = ['no_power', 'dirty', 'locked', 'overcrowded', 'other'];
const geminiApiKey = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;
const geminiVisionModel = 'gemini-2.0-flash';
const visionPrompt =
  'You are a campus facility assistant. Look at this photo and categorize the issue into exactly one of these categories: no_power, dirty, locked, overcrowded, other. Respond with only the category label, nothing else.';

const toTitleLabel = (value: IssueType): string =>
  value
    .split('_')
    .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : part))
    .join(' ');

const fileToDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
        return;
      }
      reject(new Error('Unable to read image file.'));
    };
    reader.onerror = () => reject(new Error('Unable to read image file.'));
    reader.readAsDataURL(file);
  });

const parseIssueTypeFromGemini = (value: string): IssueType | null => {
  const normalized = value.trim().toLowerCase().replace(/[^a-z_]/g, '');
  const exactMatch = issueTypes.find((type) => type === normalized);
  if (exactMatch) return exactMatch;

  const fallbackMatch = issueTypes.find((type) => value.toLowerCase().includes(type));
  return fallbackMatch ?? null;
};

export default function ReportModal({ isOpen, onClose }: ReportModalProps) {
  const [spaces, setSpaces] = useState<SpaceOption[]>([]);
  const [spacesLoading, setSpacesLoading] = useState(false);
  const [selectedSpaceId, setSelectedSpaceId] = useState('');
  const [selectedIssueType, setSelectedIssueType] = useState<IssueType | null>(null);
  const [description, setDescription] = useState('');
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [photoFileName, setPhotoFileName] = useState('');
  const [visionLoading, setVisionLoading] = useState(false);
  const [magicIssueType, setMagicIssueType] = useState<IssueType | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    let active = true;

    const loadSpaces = async () => {
      setSpacesLoading(true);
      const { data, error } = await supabase.from('spaces').select('id,name').order('name', { ascending: true });
      if (!active) return;

      if (!error) {
        const nextSpaces = (data ?? [])
          .filter((row) => typeof row.id === 'string' && typeof row.name === 'string')
          .map((row) => ({ id: row.id as string, name: row.name as string }));
        setSpaces(nextSpaces);
      } else {
        setSpaces([]);
      }

      setSpacesLoading(false);
    };

    void loadSpaces();

    return () => {
      active = false;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!magicIssueType) return;

    const timeoutId = setTimeout(() => {
      setMagicIssueType(null);
    }, 850);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [magicIssueType]);

  const resetForm = () => {
    setSelectedSpaceId('');
    setSelectedIssueType(null);
    setDescription('');
    setPhotoDataUrl(null);
    setPhotoFileName('');
    setVisionLoading(false);
    setMagicIssueType(null);
    setIsSubmitting(false);
    setSubmitSuccess(false);
  };

  const closeModal = () => {
    onClose();
    resetForm();
  };

  const detectIssueTypeWithGemini = async (dataUrl: string, mimeType: string) => {
    if (!geminiApiKey) {
      return;
    }

    const base64Data = dataUrl.split(',')[1] ?? '';
    if (!base64Data) {
      return;
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${geminiVisionModel}:generateContent?key=${geminiApiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: visionPrompt },
                {
                  inline_data: {
                    mime_type: mimeType,
                    data: base64Data,
                  },
                },
              ],
            },
          ],
        }),
      },
    );

    if (!response.ok) {
      return;
    }

    const payload = (await response.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const text = payload.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    const detected = parseIssueTypeFromGemini(text);
    if (!detected) {
      return;
    }

    setSelectedIssueType(detected);
    setMagicIssueType(detected);
  };

  const handlePhotoUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setVisionLoading(true);
    setPhotoFileName(file.name);

    try {
      const dataUrl = await fileToDataUrl(file);
      setPhotoDataUrl(dataUrl);
      await detectIssueTypeWithGemini(dataUrl, file.type || 'image/jpeg');
    } catch {
      // Keep manual issue selection available if photo processing fails.
    } finally {
      setVisionLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!selectedSpaceId || !selectedIssueType || isSubmitting) {
      return;
    }

    setIsSubmitting(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setIsSubmitting(false);
      return;
    }

    const { error } = await supabase.from('reports').insert({
      user_id: user.id,
      space_id: selectedSpaceId,
      issue_type: selectedIssueType,
      description: description.trim() || null,
      photo_url: photoDataUrl,
    });

    if (error) {
      setIsSubmitting(false);
      return;
    }

    setSubmitSuccess(true);
    setIsSubmitting(false);
    setTimeout(() => {
      closeModal();
    }, 900);
  };

  const submitDisabled = useMemo(
    () => !selectedSpaceId || !selectedIssueType || isSubmitting || submitSuccess,
    [isSubmitting, selectedIssueType, selectedSpaceId, submitSuccess],
  );

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
      role="dialog"
      aria-modal="true"
      aria-label="Report an Issue"
      onClick={closeModal}
    >
      <div className="w-full max-w-[480px] rounded-xl bg-white p-8" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between">
          <h2 className="text-xl font-bold text-black">Report an Issue</h2>
          <button
            type="button"
            onClick={closeModal}
            className="rounded-md p-1 text-gray-500 transition hover:bg-gray-100 hover:text-black"
            aria-label="Close report modal"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none">
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="mt-5 space-y-4">
          <div>
            <label htmlFor="report-space" className="mb-1.5 block text-sm font-medium text-black">
              Space
            </label>
            <select
              id="report-space"
              value={selectedSpaceId}
              onChange={(event) => setSelectedSpaceId(event.target.value)}
              className="w-full rounded-lg border border-gray-200 bg-white p-3 text-sm text-black outline-none focus:border-black"
            >
              <option value="">{spacesLoading ? 'Loading spaces...' : 'Select a space'}</option>
              {spaces.map((space) => (
                <option key={space.id} value={space.id}>
                  {space.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-black">Photo (optional)</label>
            <label className="flex cursor-pointer items-center justify-center rounded-lg border border-dashed border-gray-300 bg-white p-6 text-sm text-gray-600 transition hover:border-black">
              <input type="file" accept="image/*" className="hidden" onChange={(event) => void handlePhotoUpload(event)} />
              <span>{photoFileName || 'Upload a photo'}</span>
            </label>
            {visionLoading && (
              <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
                <span className="h-3.5 w-3.5 animate-spin rounded-full border border-gray-300 border-t-black" />
                <span>Gemini is analyzing your photo...</span>
              </div>
            )}
          </div>

          <div>
            <p className="mb-2 text-sm font-medium text-black">Issue Type</p>
            <div className="flex flex-wrap gap-2">
              {issueTypes.map((type) => {
                const active = selectedIssueType === type;
                const magical = magicIssueType === type;
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setSelectedIssueType(type)}
                    className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                      active ? 'bg-black text-white' : 'border border-gray-200 bg-white text-gray-700'
                    } ${magical ? 'animate-pulse scale-105' : ''}`}
                  >
                    {toTitleLabel(type)}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label htmlFor="report-description" className="mb-1.5 block text-sm font-medium text-black">
              Description
            </label>
            <textarea
              id="report-description"
              rows={3}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Describe the issue in more detail (optional)"
              className="w-full resize-none rounded-lg border border-gray-200 bg-white p-3 text-sm text-black outline-none focus:border-black"
            />
          </div>

          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={submitDisabled}
            className="w-full rounded-lg bg-black px-4 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitSuccess ? 'Report submitted \u2713' : isSubmitting ? 'Submitting...' : 'Submit Report'}
          </button>
        </div>
      </div>
    </div>
  );
}


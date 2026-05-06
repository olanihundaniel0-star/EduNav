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

type IssueType = 'broken_ac' | 'no_power' | 'dirty' | 'locked' | 'overcrowded' | 'other';

const issueTypes: IssueType[] = ['broken_ac', 'no_power', 'dirty', 'locked', 'overcrowded', 'other'];
const geminiApiKey = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;
const reportPhotoBucket = (import.meta.env.VITE_REPORT_PHOTO_BUCKET as string | undefined) ?? 'report-photos';
const geminiVisionModel = 'gemini-2.5-flash-lite';
const maxPhotoSizeBytes = 8 * 1024 * 1024;
const visionPrompt =
  'You are a campus facility assistant. Look at this photo and categorize the issue into exactly one of these categories: broken_ac, no_power, dirty, locked, overcrowded, other. Respond with only the category label, nothing else.';

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

const getPhotoExtension = (file: File): string => {
  const fromName = file.name.split('.').pop()?.toLowerCase();
  if (fromName && /^[a-z0-9]+$/.test(fromName)) {
    return fromName;
  }

  if (file.type === 'image/png') return 'png';
  if (file.type === 'image/webp') return 'webp';
  if (file.type === 'image/gif') return 'gif';
  return 'jpg';
};

const uploadPhotoToStorage = async (userId: string, file: File): Promise<string | null> => {
  const extension = getPhotoExtension(file);
  const randomPart = Math.random().toString(36).slice(2, 10);
  const path = `${userId}/${Date.now()}-${randomPart}.${extension}`;

  const { error: uploadError } = await supabase.storage.from(reportPhotoBucket).upload(path, file, {
    contentType: file.type || 'image/jpeg',
    upsert: false,
  });

  if (uploadError) {
    return null;
  }

  const { data } = supabase.storage.from(reportPhotoBucket).getPublicUrl(path);
  return data.publicUrl || null;
};

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
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoFileName, setPhotoFileName] = useState('');
  const [photoNotice, setPhotoNotice] = useState<string | null>(null);
  const [visionLoading, setVisionLoading] = useState(false);
  const [magicIssueType, setMagicIssueType] = useState<IssueType | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
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
    setPhotoFile(null);
    setPhotoFileName('');
    setPhotoNotice(null);
    setVisionLoading(false);
    setMagicIssueType(null);
    setIsSubmitting(false);
    setSubmitError(null);
    setSubmitSuccess(false);
  };

  const closeModal = () => {
    onClose();
    resetForm();
  };

  const detectIssueTypeWithGemini = async (dataUrl: string, mimeType: string): Promise<boolean> => {
    if (!geminiApiKey) {
      return false;
    }

    const base64Data = dataUrl.split(',')[1] ?? '';
    if (!base64Data) {
      return false;
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${geminiVisionModel}:generateContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': geminiApiKey,
        },
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
      return false;
    }

    const payload = (await response.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const text = payload.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    const detected = parseIssueTypeFromGemini(text);
    if (!detected) {
      return false;
    }

    setSelectedIssueType(detected);
    setMagicIssueType(detected);
    return true;
  };

  const handlePhotoUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setPhotoNotice(null);
    setSubmitError(null);

    if (!file.type.startsWith('image/')) {
      setPhotoFile(null);
      setPhotoFileName('');
      setPhotoNotice('Please upload a valid image file.');
      event.target.value = '';
      return;
    }

    if (file.size > maxPhotoSizeBytes) {
      setPhotoFile(null);
      setPhotoFileName('');
      setPhotoNotice('Photo is too large. Please upload an image smaller than 8MB.');
      event.target.value = '';
      return;
    }

    setVisionLoading(true);
    setPhotoFile(file);
    setPhotoFileName(file.name);

    try {
      const dataUrl = await fileToDataUrl(file);
      const autoDetected = await detectIssueTypeWithGemini(dataUrl, file.type || 'image/jpeg');
      if (!autoDetected) {
        setPhotoNotice('Could not auto-detect issue type. Please choose it manually.');
      }
    } catch {
      setPhotoNotice('Could not process that image. Please try another file.');
    } finally {
      setVisionLoading(false);
      event.target.value = '';
    }
  };

  const handleSubmit = async () => {
    if (!selectedSpaceId || !selectedIssueType || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setSubmitError('You need to be signed in to submit a report.');
      setIsSubmitting(false);
      return;
    }

    let uploadedPhotoUrl: string | null = null;
    if (photoFile) {
      uploadedPhotoUrl = await uploadPhotoToStorage(user.id, photoFile);
      if (!uploadedPhotoUrl) {
        setPhotoNotice('Photo upload failed, so this report will be submitted without a photo.');
      }
    }

    const { error } = await supabase.from('reports').insert({
      user_id: user.id,
      space_id: selectedSpaceId,
      issue_type: selectedIssueType,
      description: description.trim() || null,
      photo_url: uploadedPhotoUrl,
    });

    if (error) {
      setSubmitError('Could not submit report right now. Please try again.');
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
              className="w-full cursor-pointer rounded-lg border border-gray-200 bg-white p-3 text-sm text-black outline-none transition-all duration-150 focus:border-transparent focus:ring-2 focus:ring-[#4285F4]"
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
            {photoNotice && <p className="mt-2 text-xs text-[#B45309]">{photoNotice}</p>}
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
                    className={`cursor-pointer rounded-full px-3 py-1.5 text-xs font-medium transition-all duration-150 hover:scale-105 ${
                      active ? 'bg-black text-white' : 'border border-gray-200 bg-white text-gray-700'
                    } ${magical ? 'animate-pulse' : ''}`}
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
              className="w-full resize-none rounded-lg border border-gray-200 bg-white p-3 text-sm text-black outline-none transition-all duration-150 focus:border-transparent focus:ring-2 focus:ring-[#4285F4]"
            />
          </div>

          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={submitDisabled}
            className="w-full cursor-pointer rounded-lg bg-black px-4 py-3 text-sm font-medium text-white transition-colors duration-150 hover:bg-gray-800 active:bg-gray-900 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitSuccess ? 'Report submitted \u2713' : isSubmitting ? 'Submitting...' : 'Submit Report'}
          </button>
          {submitError && <p className="text-xs text-[#DB4437]">{submitError}</p>}
        </div>
      </div>
    </div>
  );
}

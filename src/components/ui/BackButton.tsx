import { useNavigate } from 'react-router-dom';

type BackButtonProps = {
  fallbackTo?: string;
  className?: string;
  ariaLabel?: string;
};

export default function BackButton({
  fallbackTo = '/dashboard',
  className = '',
  ariaLabel = 'Go back',
}: BackButtonProps) {
  const navigate = useNavigate();

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }

    if (fallbackTo) {
      navigate(fallbackTo);
    }
  };

  return (
    <button
      type="button"
      onClick={handleBack}
      className={`inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-black ${className}`}
      aria-label={ariaLabel}
    >
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none">
        <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}

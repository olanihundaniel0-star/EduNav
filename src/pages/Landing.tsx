import Logo from '../components/ui/Logo';
import SplitText from '../components/ui/SplitText';
import { supabase } from '../lib/supabase';

const spaces = [
  'Main Library',
  'AKT Underground',
  'Engineering Quad',
  'Faculty of Science Library',
  'Faculty of Social Sciences Library',
];

function DotGridBackground() {
  return (
    <div
      aria-hidden="true"
      className="absolute inset-0 z-0 h-full w-full"
      style={{
        backgroundImage: 'radial-gradient(circle, #d1d1d1 1px, transparent 1px)',
        backgroundSize: '24px 24px',
      }}
    />
  );
}

export default function Landing() {
  const handleGoogleSignIn = async () => {
    await supabase.auth.signInWithOAuth({ provider: 'google' });
  };

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-[#0A0A0A] font-['Space_Grotesk']">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-6">
        <nav className="relative z-10 flex items-center justify-between py-6">
          <Logo className="h-9 w-9 text-black" />
        </nav>

        <main className="relative flex flex-1 flex-col items-center justify-center overflow-hidden text-center">
          <DotGridBackground />
          <div className="relative z-10">
            <SplitText
              tag="h1"
              text="Navigate your campus."
              className="split-headline text-4xl leading-tight sm:text-5xl md:text-6xl font-light"
              delay={40}
              duration={0.6}
              ease="power3.out"
              splitType="words, chars"
              from={{ opacity: 0, y: 28 }}
              to={{ opacity: 1, y: 0 }}
              threshold={0.2}
              rootMargin="-120px"
              textAlign="center"
            />
            <p className="mt-4 max-w-2xl text-base sm:text-lg">
              Real-time study space intelligence, powered by your peers.
            </p>
            <button
              type="button"
              onClick={handleGoogleSignIn}
              className="mt-8 cursor-pointer rounded-full bg-[#4285F4] px-6 py-3 text-sm font-semibold text-[#FAFAFA] transition-colors duration-150 hover:bg-blue-600 active:bg-blue-700"
            >
              Continue with Google
            </button>
          </div>
        </main>

        <div className="relative z-10 pb-10">
          <div className="flex flex-wrap items-center justify-center gap-4 text-sm font-medium">
            {spaces.map((space) => (
              <div key={space} className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-[#4285F4]" />
                <span>{space}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

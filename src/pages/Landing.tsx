import { supabase } from '../lib/supabase';

const spaces = [
  'Main Library',
  'AKT Underground',
  'Engineering Quad',
  'Faculty of Science Library',
  'Faculty of Social Sciences Library',
];

export default function Landing() {
  const handleGoogleSignIn = async () => {
    await supabase.auth.signInWithOAuth({ provider: 'google' });
  };

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-[#0A0A0A] font-['Space_Grotesk']">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-6">
        <nav className="flex items-center justify-between py-6">
          <div className="text-xl font-semibold tracking-tight">EduNav</div>
          <button
            type="button"
            onClick={handleGoogleSignIn}
            className="rounded-full bg-[#4285F4] px-4 py-2 text-sm font-semibold text-[#FAFAFA]"
          >
            Sign in
          </button>
        </nav>

        <main className="flex flex-1 flex-col items-center justify-center text-center">
          <h1 className="text-4xl leading-tight sm:text-5xl md:text-6xl">
            <span className="font-light">Navigate your </span>
            <span className="font-semibold">campus.</span>
          </h1>
          <p className="mt-4 max-w-2xl text-base sm:text-lg">
            Real-time study space intelligence, powered by your peers.
          </p>
          <button
            type="button"
            onClick={handleGoogleSignIn}
            className="mt-8 rounded-full bg-[#4285F4] px-6 py-3 text-sm font-semibold text-[#FAFAFA]"
          >
            Continue with Google
          </button>
        </main>

        <div className="pb-10">
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

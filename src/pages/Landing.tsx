import { supabase } from '../lib/supabase';

const spaces = [
  'Main Library',
  'AKT Underground',
  'Engineering Quad',
  'Faculty of Science Library',
  'Faculty of Social Sciences Library',
];

function DotGridBackground() {
  const width = 1600;
  const height = 720;
  const gap = 20;
  const centerX = width / 2;
  const centerY = height / 2;

  const dots: JSX.Element[] = [];

  for (let y = 0; y <= height; y += gap) {
    for (let x = 0; x <= width; x += gap) {
      const xDistance = Math.abs(x - centerX) / centerX;
      const yDistance = Math.abs(y - centerY) / centerY;

      // Sparse through the center where the headline sits, denser on side flanks.
      const centerCut = 0.1 + 0.8 * Math.pow(xDistance, 1.2);
      // Fade toward top/bottom and outer edges for softer falloff.
      const edgeFade = Math.max(0, 1 - Math.pow(yDistance, 1.6) * 0.75);
      const opacity = Math.max(0.05, Math.min(0.9, centerCut * edgeFade));

      dots.push(<circle key={`${x}-${y}`} cx={x} cy={y} r="1.5" fill="#c8c8c8" opacity={opacity} />);
    }
  }

  return (
    <svg
      aria-hidden="true"
      className="absolute inset-0 z-0 h-full w-full"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
    >
      {dots}
    </svg>
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
          <div className="text-xl font-semibold tracking-tight">EduNav</div>
          <button
            type="button"
            onClick={handleGoogleSignIn}
            className="rounded-full bg-[#4285F4] px-4 py-2 text-sm font-semibold text-[#FAFAFA]"
          >
            Sign in
          </button>
        </nav>

        <main className="relative flex flex-1 flex-col items-center justify-center overflow-hidden text-center">
          <DotGridBackground />
          <div className="relative z-10">
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

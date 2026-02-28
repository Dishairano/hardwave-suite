export default function ConceptBPage() {
  return (
    <div className="min-h-screen bg-black text-white overflow-hidden">
      {/* Animated Background */}
      <div className="fixed inset-0 z-0">
        {/* Gradient mesh */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-fuchsia-900/40 via-black to-black" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,_var(--tw-gradient-stops))] from-cyan-900/30 via-transparent to-transparent" />

        {/* Scan lines effect */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.03) 2px, rgba(255,255,255,0.03) 4px)`
          }}
        />

        {/* Noise texture overlay */}
        <div
          className="absolute inset-0 opacity-[0.15]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`
          }}
        />
      </div>

      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-10 h-10 bg-gradient-to-br from-fuchsia-500 via-pink-500 to-cyan-400 transform -skew-x-12" />
                <div className="absolute inset-0 w-10 h-10 bg-gradient-to-br from-cyan-400 to-fuchsia-500 transform skew-x-12 mix-blend-screen opacity-50" />
              </div>
              <span className="text-2xl font-black tracking-tighter uppercase">Hardwave</span>
            </div>

            <div className="hidden md:flex items-center gap-6 text-sm font-bold uppercase tracking-wider">
              <a href="#features" className="hover:text-fuchsia-400 transition-colors">Features</a>
              <a href="#tools" className="hover:text-fuchsia-400 transition-colors">Tools</a>
              <a href="#pricing" className="hover:text-fuchsia-400 transition-colors">Pricing</a>
            </div>

            <div className="flex items-center gap-4">
              <a href="/login" className="text-sm font-bold uppercase tracking-wider hover:text-fuchsia-400 transition-colors">Login</a>
              <a
                href="/downloads"
                className="px-6 py-3 text-sm font-black uppercase tracking-wider bg-gradient-to-r from-fuchsia-500 to-pink-500 transform -skew-x-6 hover:scale-105 transition-transform"
              >
                <span className="inline-block transform skew-x-6">Get It</span>
              </a>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center pt-20">
        <div className="relative z-10 max-w-6xl mx-auto px-6 text-center">
          {/* Badge */}
          <div className="inline-block mb-8">
            <div className="px-4 py-2 bg-gradient-to-r from-fuchsia-500/20 to-cyan-500/20 border-l-4 border-fuchsia-500 transform -skew-x-6">
              <span className="inline-block transform skew-x-6 text-sm font-bold uppercase tracking-widest text-fuchsia-400">
                Concept B: Underground
              </span>
            </div>
          </div>

          {/* Main heading with glitch effect styling */}
          <h1 className="relative mb-8">
            <span className="block text-6xl md:text-8xl lg:text-9xl font-black uppercase tracking-tighter leading-none">
              <span className="relative inline-block">
                <span className="relative z-10 bg-gradient-to-r from-white via-fuchsia-200 to-white bg-clip-text text-transparent">Unleash</span>
              </span>
            </span>
            <span className="block text-6xl md:text-8xl lg:text-9xl font-black uppercase tracking-tighter leading-none mt-2">
              <span className="relative inline-block">
                <span className="relative z-10 bg-gradient-to-r from-fuchsia-400 via-pink-500 to-cyan-400 bg-clip-text text-transparent">The Raw</span>
              </span>
            </span>
            <span className="block text-6xl md:text-8xl lg:text-9xl font-black uppercase tracking-tighter leading-none mt-2">
              <span className="relative z-10 bg-gradient-to-r from-cyan-400 via-fuchsia-400 to-pink-500 bg-clip-text text-transparent">Power</span>
            </span>
          </h1>

          <p className="text-xl md:text-2xl text-gray-300 max-w-3xl mx-auto mb-12 font-medium">
            Audio tools forged in the fire of{' '}
            <span className="text-fuchsia-400 font-bold">hardstyle</span>,{' '}
            <span className="text-pink-400 font-bold">hardcore</span>, and{' '}
            <span className="text-cyan-400 font-bold">raw</span>.
            No compromises. No limits.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
            <a
              href="/downloads"
              className="group relative px-12 py-5 text-lg font-black uppercase tracking-wider"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-fuchsia-600 via-pink-500 to-fuchsia-600 transform -skew-x-12 group-hover:skew-x-0 transition-transform" />
              <div className="absolute inset-0 bg-gradient-to-r from-cyan-500 to-fuchsia-500 transform skew-x-12 group-hover:skew-x-0 opacity-0 group-hover:opacity-100 transition-all" />
              <span className="relative z-10">Download Now</span>
            </a>
            <a
              href="#features"
              className="px-12 py-5 text-lg font-black uppercase tracking-wider border-2 border-white/20 hover:border-fuchsia-500 hover:text-fuchsia-400 transition-all transform hover:-skew-x-6"
            >
              See Features
            </a>
          </div>

          {/* Stats */}
          <div className="mt-20 grid grid-cols-3 gap-8 max-w-2xl mx-auto">
            <div className="text-center">
              <div className="text-4xl md:text-5xl font-black bg-gradient-to-r from-fuchsia-400 to-pink-400 bg-clip-text text-transparent">150+</div>
              <div className="text-sm uppercase tracking-wider text-gray-500 mt-2">BPM Range</div>
            </div>
            <div className="text-center">
              <div className="text-4xl md:text-5xl font-black bg-gradient-to-r from-pink-400 to-cyan-400 bg-clip-text text-transparent">10K+</div>
              <div className="text-sm uppercase tracking-wider text-gray-500 mt-2">Producers</div>
            </div>
            <div className="text-center">
              <div className="text-4xl md:text-5xl font-black bg-gradient-to-r from-cyan-400 to-fuchsia-400 bg-clip-text text-transparent">100%</div>
              <div className="text-sm uppercase tracking-wider text-gray-500 mt-2">Hardcore</div>
            </div>
          </div>
        </div>

        {/* Decorative elements */}
        <div className="absolute bottom-0 left-0 w-1/3 h-px bg-gradient-to-r from-fuchsia-500 to-transparent" />
        <div className="absolute bottom-0 right-0 w-1/3 h-px bg-gradient-to-l from-cyan-500 to-transparent" />
      </section>

      {/* Features Section */}
      <section id="features" className="relative py-32">
        <div className="absolute left-0 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-fuchsia-500/50 to-transparent" />
        <div className="absolute right-0 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-cyan-500/50 to-transparent" />

        <div className="relative z-10 max-w-7xl mx-auto px-6">
          <div className="text-center mb-20">
            <h2 className="text-5xl md:text-7xl font-black uppercase tracking-tighter mb-6">
              <span className="bg-gradient-to-r from-fuchsia-400 via-pink-500 to-cyan-400 bg-clip-text text-transparent">
                Built Different
              </span>
            </h2>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto">
              Every tool designed for maximum impact
            </p>
          </div>

          {/* Feature Grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-1">
            {/* Feature 1 */}
            <div className="group relative p-8 bg-gradient-to-br from-white/[0.03] to-transparent border border-white/5 hover:border-fuchsia-500/50 transition-all">
              <div className="absolute top-0 left-0 w-8 h-px bg-fuchsia-500" />
              <div className="absolute top-0 left-0 w-px h-8 bg-fuchsia-500" />
              <div className="w-16 h-16 mb-6 bg-gradient-to-br from-fuchsia-500/20 to-transparent border border-fuchsia-500/30 transform -skew-x-6 flex items-center justify-center">
                <svg className="w-8 h-8 text-fuchsia-400 transform skew-x-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                </svg>
              </div>
              <h3 className="text-2xl font-black uppercase tracking-tight mb-3">Key Detection</h3>
              <p className="text-gray-400">
                Brutal accuracy even on the hardest kicks and screeches. Made for the scene.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="group relative p-8 bg-gradient-to-br from-white/[0.03] to-transparent border border-white/5 hover:border-pink-500/50 transition-all">
              <div className="absolute top-0 left-0 w-8 h-px bg-pink-500" />
              <div className="absolute top-0 left-0 w-px h-8 bg-pink-500" />
              <div className="w-16 h-16 mb-6 bg-gradient-to-br from-pink-500/20 to-transparent border border-pink-500/30 transform -skew-x-6 flex items-center justify-center">
                <svg className="w-8 h-8 text-pink-400 transform skew-x-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="text-2xl font-black uppercase tracking-tight mb-3">150-200+ BPM</h3>
              <p className="text-gray-400">
                Precise tempo detection at extreme speeds. From hardstyle to speedcore.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="group relative p-8 bg-gradient-to-br from-white/[0.03] to-transparent border border-white/5 hover:border-cyan-500/50 transition-all">
              <div className="absolute top-0 left-0 w-8 h-px bg-cyan-500" />
              <div className="absolute top-0 left-0 w-px h-8 bg-cyan-500" />
              <div className="w-16 h-16 mb-6 bg-gradient-to-br from-cyan-500/20 to-transparent border border-cyan-500/30 transform -skew-x-6 flex items-center justify-center">
                <svg className="w-8 h-8 text-cyan-400 transform skew-x-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <h3 className="text-2xl font-black uppercase tracking-tight mb-3">Mass Organize</h3>
              <p className="text-gray-400">
                Thousands of samples. Instantly tagged. Zero manual work required.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="group relative p-8 bg-gradient-to-br from-white/[0.03] to-transparent border border-white/5 hover:border-fuchsia-500/50 transition-all">
              <div className="absolute top-0 left-0 w-8 h-px bg-fuchsia-500" />
              <div className="absolute top-0 left-0 w-px h-8 bg-fuchsia-500" />
              <div className="w-16 h-16 mb-6 bg-gradient-to-br from-fuchsia-500/20 to-transparent border border-fuchsia-500/30 transform -skew-x-6 flex items-center justify-center">
                <svg className="w-8 h-8 text-fuchsia-400 transform skew-x-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-2xl font-black uppercase tracking-tight mb-3">Pitch Destroy</h3>
              <p className="text-gray-400">
                Extreme pitch shifting that maintains clarity. Push sounds to their limits.
              </p>
            </div>

            {/* Feature 5 */}
            <div className="group relative p-8 bg-gradient-to-br from-white/[0.03] to-transparent border border-white/5 hover:border-pink-500/50 transition-all">
              <div className="absolute top-0 left-0 w-8 h-px bg-pink-500" />
              <div className="absolute top-0 left-0 w-px h-8 bg-pink-500" />
              <div className="w-16 h-16 mb-6 bg-gradient-to-br from-pink-500/20 to-transparent border border-pink-500/30 transform -skew-x-6 flex items-center justify-center">
                <svg className="w-8 h-8 text-pink-400 transform skew-x-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-2xl font-black uppercase tracking-tight mb-3">Quick Cut</h3>
              <p className="text-gray-400">
                Slice samples with surgical precision. Snap to beats, bars, or milliseconds.
              </p>
            </div>

            {/* Feature 6 */}
            <div className="group relative p-8 bg-gradient-to-br from-white/[0.03] to-transparent border border-white/5 hover:border-cyan-500/50 transition-all">
              <div className="absolute top-0 left-0 w-8 h-px bg-cyan-500" />
              <div className="absolute top-0 left-0 w-px h-8 bg-cyan-500" />
              <div className="w-16 h-16 mb-6 bg-gradient-to-br from-cyan-500/20 to-transparent border border-cyan-500/30 transform -skew-x-6 flex items-center justify-center">
                <svg className="w-8 h-8 text-cyan-400 transform skew-x-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="text-2xl font-black uppercase tracking-tight mb-3">Spectrum View</h3>
              <p className="text-gray-400">
                Real-time frequency analysis. See the power in every kick and bass.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Social Proof Section */}
      <section className="relative py-32 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-fuchsia-900/20 via-black to-cyan-900/20" />

        <div className="relative z-10 max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-5xl md:text-7xl font-black uppercase tracking-tighter mb-6">
              <span className="bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
                From The Scene
              </span>
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Quote 1 */}
            <div className="relative p-8 border-l-4 border-fuchsia-500 bg-gradient-to-r from-fuchsia-500/10 to-transparent">
              <div className="text-6xl font-black text-fuchsia-500/20 absolute top-4 left-4">&quot;</div>
              <p className="text-xl text-gray-200 mb-6 relative z-10">
                Finally something made for US. Not some generic music tool - this is hardcore through and through.
              </p>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-gradient-to-br from-fuchsia-500 to-pink-500 transform -skew-x-6" />
                <div>
                  <div className="font-black uppercase">DJ Distortion</div>
                  <div className="text-sm text-gray-500">Raw Hardstyle</div>
                </div>
              </div>
            </div>

            {/* Quote 2 */}
            <div className="relative p-8 border-l-4 border-pink-500 bg-gradient-to-r from-pink-500/10 to-transparent">
              <div className="text-6xl font-black text-pink-500/20 absolute top-4 left-4">&quot;</div>
              <p className="text-xl text-gray-200 mb-6 relative z-10">
                Organized my entire 50GB sample library in one session. Absolute game changer.
              </p>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-gradient-to-br from-pink-500 to-cyan-500 transform -skew-x-6" />
                <div>
                  <div className="font-black uppercase">TerrorByte</div>
                  <div className="text-sm text-gray-500">Uptempo Terror</div>
                </div>
              </div>
            </div>

            {/* Quote 3 */}
            <div className="relative p-8 border-l-4 border-cyan-500 bg-gradient-to-r from-cyan-500/10 to-transparent">
              <div className="text-6xl font-black text-cyan-500/20 absolute top-4 left-4">&quot;</div>
              <p className="text-xl text-gray-200 mb-6 relative z-10">
                The pitch shifter handles 200+ BPM vocals without breaking. Nothing else comes close.
              </p>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-gradient-to-br from-cyan-500 to-fuchsia-500 transform -skew-x-6" />
                <div>
                  <div className="font-black uppercase">SpeedFreak</div>
                  <div className="text-sm text-gray-500">Speedcore</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="relative py-32">
        <div className="relative z-10 max-w-5xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-5xl md:text-7xl font-black uppercase tracking-tighter mb-6">
              <span className="bg-gradient-to-r from-fuchsia-400 to-cyan-400 bg-clip-text text-transparent">
                Get Armed
              </span>
            </h2>
            <p className="text-xl text-gray-400">
              Free to start. Upgrade to unlock the full arsenal.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {/* Free */}
            <div className="relative p-8 bg-white/[0.02] border border-white/10">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-white/50 to-transparent" />
              <div className="text-2xl font-black uppercase tracking-tight text-gray-400 mb-2">Recruit</div>
              <div className="text-5xl font-black mb-8">
                $0
                <span className="text-lg font-normal text-gray-500">/forever</span>
              </div>
              <ul className="space-y-4 mb-8">
                {['Key Detection', 'BPM Analysis', 'Basic Library', 'Spectrum Analyzer'].map((item) => (
                  <li key={item} className="flex items-center gap-3">
                    <div className="w-6 h-6 bg-white/10 transform -skew-x-6 flex items-center justify-center">
                      <svg className="w-4 h-4 text-white transform skew-x-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <a
                href="/downloads"
                className="block w-full py-4 text-center font-black uppercase tracking-wider border-2 border-white/20 hover:border-white hover:bg-white/5 transition-all"
              >
                Download Free
              </a>
            </div>

            {/* Pro */}
            <div className="relative p-8 bg-gradient-to-br from-fuchsia-500/10 to-cyan-500/10 border border-fuchsia-500/50">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-fuchsia-500 via-pink-500 to-cyan-500" />
              <div className="absolute -top-4 right-8 px-4 py-1 bg-gradient-to-r from-fuchsia-500 to-pink-500 text-sm font-black uppercase tracking-wider transform -skew-x-6">
                <span className="inline-block transform skew-x-6">Full Power</span>
              </div>
              <div className="text-2xl font-black uppercase tracking-tight text-fuchsia-400 mb-2">Warrior</div>
              <div className="text-5xl font-black mb-8">
                $9
                <span className="text-lg font-normal text-gray-500">/month</span>
              </div>
              <ul className="space-y-4 mb-8">
                {['Everything in Recruit', 'Audio Trimmer', 'Pitch Shifter', 'BPM Changer', 'Cloud Sync', 'Priority Support'].map((item) => (
                  <li key={item} className="flex items-center gap-3">
                    <div className="w-6 h-6 bg-fuchsia-500/30 transform -skew-x-6 flex items-center justify-center">
                      <svg className="w-4 h-4 text-fuchsia-400 transform skew-x-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <a
                href="/register"
                className="block w-full py-4 text-center font-black uppercase tracking-wider bg-gradient-to-r from-fuchsia-600 to-pink-500 hover:from-fuchsia-500 hover:to-pink-400 transition-all transform hover:-skew-x-3"
              >
                <span className="inline-block hover:skew-x-3 transition-transform">Unlock Everything</span>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="relative py-32 overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-to-r from-fuchsia-600/30 via-pink-600/20 to-cyan-600/30 rounded-full blur-[200px]" />
        </div>

        <div className="relative z-10 max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-5xl md:text-7xl font-black uppercase tracking-tighter mb-8">
            <span className="block">Stop Waiting.</span>
            <span className="block bg-gradient-to-r from-fuchsia-400 via-pink-400 to-cyan-400 bg-clip-text text-transparent">
              Start Creating.
            </span>
          </h2>

          <a
            href="/downloads"
            className="inline-block px-16 py-6 text-xl font-black uppercase tracking-wider bg-gradient-to-r from-fuchsia-600 via-pink-500 to-cyan-500 hover:from-fuchsia-500 hover:via-pink-400 hover:to-cyan-400 transition-all transform hover:scale-105 shadow-2xl shadow-fuchsia-500/30"
          >
            Download Now - It&apos;s Free
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative py-16 border-t border-white/5">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid md:grid-cols-4 gap-12">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-gradient-to-br from-fuchsia-500 to-cyan-400 transform -skew-x-12" />
                <span className="text-2xl font-black tracking-tighter uppercase">Hardwave</span>
              </div>
              <p className="text-gray-500 text-sm">
                Raw power for raw music. Built by producers, for producers.
              </p>
            </div>

            <div>
              <h4 className="font-black uppercase tracking-wider mb-4">Product</h4>
              <ul className="space-y-3 text-sm text-gray-400">
                <li><a href="/downloads" className="hover:text-fuchsia-400 transition-colors">Downloads</a></li>
                <li><a href="/roadmap" className="hover:text-fuchsia-400 transition-colors">Roadmap</a></li>
                <li><a href="#pricing" className="hover:text-fuchsia-400 transition-colors">Pricing</a></li>
              </ul>
            </div>

            <div>
              <h4 className="font-black uppercase tracking-wider mb-4">Account</h4>
              <ul className="space-y-3 text-sm text-gray-400">
                <li><a href="/login" className="hover:text-fuchsia-400 transition-colors">Login</a></li>
                <li><a href="/register" className="hover:text-fuchsia-400 transition-colors">Register</a></li>
                <li><a href="/dashboard" className="hover:text-fuchsia-400 transition-colors">Dashboard</a></li>
              </ul>
            </div>

            <div>
              <h4 className="font-black uppercase tracking-wider mb-4">Legal</h4>
              <ul className="space-y-3 text-sm text-gray-400">
                <li><a href="/privacy" className="hover:text-fuchsia-400 transition-colors">Privacy</a></li>
                <li><a href="/terms" className="hover:text-fuchsia-400 transition-colors">Terms</a></li>
              </ul>
            </div>
          </div>

          <div className="mt-16 pt-8 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-sm text-gray-500">&copy; 2026 Hardwave Studios. No compromises.</p>
            <p className="text-sm text-gray-600">Design Concept B: Hardwave Underground</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function ConceptCPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-white antialiased">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-zinc-950/80 backdrop-blur-lg border-b border-zinc-800/50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-fuchsia-500 flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
              </svg>
            </div>
            <span className="text-lg font-semibold">Hardwave Studios</span>
          </div>

          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-sm text-zinc-400 hover:text-white transition-colors">Features</a>
            <a href="#pricing" className="text-sm text-zinc-400 hover:text-white transition-colors">Pricing</a>
            <a href="/roadmap" className="text-sm text-zinc-400 hover:text-white transition-colors">Roadmap</a>
            <a href="/login" className="text-sm text-zinc-400 hover:text-white transition-colors">Sign in</a>
            <a href="/downloads" className="px-4 py-2 text-sm font-medium rounded-lg bg-fuchsia-500 hover:bg-fuchsia-400 transition-colors">
              Download
            </a>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center pt-16">
        {/* Subtle grid background */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `linear-gradient(to right, rgb(255 255 255 / 0.1) 1px, transparent 1px), linear-gradient(to bottom, rgb(255 255 255 / 0.1) 1px, transparent 1px)`,
            backgroundSize: '48px 48px'
          }}
        />

        {/* Gradient accent */}
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-fuchsia-500/10 rounded-full blur-[120px]" />

        <div className="relative z-10 max-w-4xl mx-auto px-6 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-800/50 border border-zinc-700/50 text-sm text-zinc-400 mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-fuchsia-500" />
            <span>Concept C: Linear Meets Rave</span>
          </div>

          <h1 className="text-5xl md:text-6xl lg:text-7xl font-semibold tracking-tight mb-6 leading-[1.1]">
            Professional tools for
            <span className="block text-fuchsia-400">electronic music</span>
          </h1>

          <p className="text-lg md:text-xl text-zinc-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            Streamline your production workflow with intelligent sample organization,
            precise audio analysis, and powerful processing tools.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
            <a
              href="/downloads"
              className="inline-flex items-center gap-2 px-6 py-3 text-base font-medium rounded-lg bg-fuchsia-500 hover:bg-fuchsia-400 transition-colors"
            >
              Download free
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </a>
            <a
              href="#features"
              className="inline-flex items-center gap-2 px-6 py-3 text-base font-medium rounded-lg border border-zinc-700 hover:border-zinc-600 hover:bg-zinc-800/50 transition-all"
            >
              View features
            </a>
          </div>

          {/* Trust indicators */}
          <div className="flex items-center justify-center gap-8 text-sm text-zinc-500">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Free tier available
            </div>
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Windows &amp; macOS
            </div>
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              10,000+ users
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 border-t border-zinc-800/50">
        <div className="max-w-6xl mx-auto px-6">
          <div className="max-w-2xl mb-16">
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight mb-4">
              Everything you need to produce
            </h2>
            <p className="text-lg text-zinc-400">
              Purpose-built tools for hardstyle, hardcore, and electronic music production.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Feature 1 */}
            <div className="group p-6 rounded-xl bg-zinc-900/50 border border-zinc-800/50 hover:border-zinc-700/50 transition-colors">
              <div className="w-10 h-10 rounded-lg bg-fuchsia-500/10 border border-fuchsia-500/20 flex items-center justify-center mb-4">
                <svg className="w-5 h-5 text-fuchsia-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                </svg>
              </div>
              <h3 className="text-lg font-medium mb-2">Key Detection</h3>
              <p className="text-sm text-zinc-400 leading-relaxed">
                AI-powered key analysis optimized for electronic music with complex harmonic content.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="group p-6 rounded-xl bg-zinc-900/50 border border-zinc-800/50 hover:border-zinc-700/50 transition-colors">
              <div className="w-10 h-10 rounded-lg bg-fuchsia-500/10 border border-fuchsia-500/20 flex items-center justify-center mb-4">
                <svg className="w-5 h-5 text-fuchsia-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium mb-2">BPM Analysis</h3>
              <p className="text-sm text-zinc-400 leading-relaxed">
                Precise tempo detection from 140-200+ BPM, perfect for hardstyle and hardcore.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="group p-6 rounded-xl bg-zinc-900/50 border border-zinc-800/50 hover:border-zinc-700/50 transition-colors">
              <div className="w-10 h-10 rounded-lg bg-fuchsia-500/10 border border-fuchsia-500/20 flex items-center justify-center mb-4">
                <svg className="w-5 h-5 text-fuchsia-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <h3 className="text-lg font-medium mb-2">Smart Organization</h3>
              <p className="text-sm text-zinc-400 leading-relaxed">
                Automatically categorize and tag your sample library with intelligent file scanning.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="group p-6 rounded-xl bg-zinc-900/50 border border-zinc-800/50 hover:border-zinc-700/50 transition-colors">
              <div className="w-10 h-10 rounded-lg bg-fuchsia-500/10 border border-fuchsia-500/20 flex items-center justify-center mb-4">
                <svg className="w-5 h-5 text-fuchsia-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium mb-2">Audio Trimmer</h3>
              <p className="text-sm text-zinc-400 leading-relaxed">
                Quick and precise audio trimming with waveform visualization and snap-to-beat.
              </p>
            </div>

            {/* Feature 5 */}
            <div className="group p-6 rounded-xl bg-zinc-900/50 border border-zinc-800/50 hover:border-zinc-700/50 transition-colors">
              <div className="w-10 h-10 rounded-lg bg-fuchsia-500/10 border border-fuchsia-500/20 flex items-center justify-center mb-4">
                <svg className="w-5 h-5 text-fuchsia-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                </svg>
              </div>
              <h3 className="text-lg font-medium mb-2">Pitch Shifter</h3>
              <p className="text-sm text-zinc-400 leading-relaxed">
                High-quality pitch shifting with formant preservation for vocals and melodics.
              </p>
            </div>

            {/* Feature 6 */}
            <div className="group p-6 rounded-xl bg-zinc-900/50 border border-zinc-800/50 hover:border-zinc-700/50 transition-colors">
              <div className="w-10 h-10 rounded-lg bg-fuchsia-500/10 border border-fuchsia-500/20 flex items-center justify-center mb-4">
                <svg className="w-5 h-5 text-fuchsia-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium mb-2">Spectrum Analyzer</h3>
              <p className="text-sm text-zinc-400 leading-relaxed">
                Real-time frequency analysis with customizable display modes and meter options.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Social Proof */}
      <section className="py-24 border-t border-zinc-800/50">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight mb-4">
              Loved by producers worldwide
            </h2>
            <p className="text-lg text-zinc-400">
              Join thousands of electronic music producers using Hardwave Studios.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {/* Testimonial 1 */}
            <div className="p-6 rounded-xl bg-zinc-900/50 border border-zinc-800/50">
              <div className="flex items-center gap-1 mb-4">
                {[...Array(5)].map((_, i) => (
                  <svg key={i} className="w-4 h-4 text-fuchsia-400" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
              </div>
              <p className="text-sm text-zinc-300 mb-4 leading-relaxed">
                &quot;The key detection is incredibly accurate even with heavily distorted kicks. Finally a tool that understands hardstyle.&quot;
              </p>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-fuchsia-500 to-fuchsia-600" />
                <div>
                  <div className="text-sm font-medium">Alex K.</div>
                  <div className="text-xs text-zinc-500">Hardstyle Producer</div>
                </div>
              </div>
            </div>

            {/* Testimonial 2 */}
            <div className="p-6 rounded-xl bg-zinc-900/50 border border-zinc-800/50">
              <div className="flex items-center gap-1 mb-4">
                {[...Array(5)].map((_, i) => (
                  <svg key={i} className="w-4 h-4 text-fuchsia-400" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
              </div>
              <p className="text-sm text-zinc-300 mb-4 leading-relaxed">
                &quot;Organized 15,000 samples in minutes. The smart tagging saves me hours of manual work every month.&quot;
              </p>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-fuchsia-500 to-fuchsia-600" />
                <div>
                  <div className="text-sm font-medium">Marco T.</div>
                  <div className="text-xs text-zinc-500">Hardcore Producer</div>
                </div>
              </div>
            </div>

            {/* Testimonial 3 */}
            <div className="p-6 rounded-xl bg-zinc-900/50 border border-zinc-800/50">
              <div className="flex items-center gap-1 mb-4">
                {[...Array(5)].map((_, i) => (
                  <svg key={i} className="w-4 h-4 text-fuchsia-400" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
              </div>
              <p className="text-sm text-zinc-300 mb-4 leading-relaxed">
                &quot;The pitch shifter maintains quality at extreme settings. Essential for creating signature uptempo vocals.&quot;
              </p>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-fuchsia-500 to-fuchsia-600" />
                <div>
                  <div className="text-sm font-medium">Sarah M.</div>
                  <div className="text-xs text-zinc-500">Uptempo Producer</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-24 border-t border-zinc-800/50">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight mb-4">
              Simple, transparent pricing
            </h2>
            <p className="text-lg text-zinc-400">
              Start free and upgrade when you&apos;re ready for more.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Free Tier */}
            <div className="p-8 rounded-2xl bg-zinc-900/50 border border-zinc-800/50">
              <div className="text-sm font-medium text-zinc-400 mb-1">Free</div>
              <div className="flex items-baseline gap-1 mb-6">
                <span className="text-4xl font-semibold">$0</span>
                <span className="text-zinc-500">/forever</span>
              </div>
              <ul className="space-y-3 mb-8">
                {['Key Detection', 'BPM Analysis', 'Basic Organization', 'Spectrum Analyzer'].map((item) => (
                  <li key={item} className="flex items-center gap-3 text-sm">
                    <svg className="w-5 h-5 text-fuchsia-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-zinc-300">{item}</span>
                  </li>
                ))}
              </ul>
              <a
                href="/downloads"
                className="block w-full py-3 text-center text-sm font-medium rounded-lg border border-zinc-700 hover:border-zinc-600 hover:bg-zinc-800/50 transition-all"
              >
                Download free
              </a>
            </div>

            {/* Pro Tier */}
            <div className="p-8 rounded-2xl bg-zinc-900/50 border border-fuchsia-500/30 relative">
              <div className="absolute -top-3 left-6 px-3 py-1 text-xs font-medium rounded-full bg-fuchsia-500 text-white">
                Popular
              </div>
              <div className="text-sm font-medium text-fuchsia-400 mb-1">Pro</div>
              <div className="flex items-baseline gap-1 mb-6">
                <span className="text-4xl font-semibold">$9</span>
                <span className="text-zinc-500">/month</span>
              </div>
              <ul className="space-y-3 mb-8">
                {['Everything in Free', 'Audio Trimmer', 'Pitch Shifter', 'BPM Changer', 'Cloud Sync', 'Priority Support'].map((item) => (
                  <li key={item} className="flex items-center gap-3 text-sm">
                    <svg className="w-5 h-5 text-fuchsia-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-zinc-300">{item}</span>
                  </li>
                ))}
              </ul>
              <a
                href="/register"
                className="block w-full py-3 text-center text-sm font-medium rounded-lg bg-fuchsia-500 hover:bg-fuchsia-400 transition-colors"
              >
                Start free trial
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 border-t border-zinc-800/50">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="text-3xl md:text-4xl font-semibold tracking-tight mb-4">
            Ready to streamline your workflow?
          </h2>
          <p className="text-lg text-zinc-400 mb-8">
            Join thousands of producers who&apos;ve upgraded their production process.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href="/downloads"
              className="inline-flex items-center gap-2 px-8 py-4 text-base font-medium rounded-lg bg-fuchsia-500 hover:bg-fuchsia-400 transition-colors"
            >
              Download for free
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </a>
            <a
              href="/roadmap"
              className="inline-flex items-center gap-2 px-8 py-4 text-base font-medium rounded-lg border border-zinc-700 hover:border-zinc-600 hover:bg-zinc-800/50 transition-all"
            >
              View roadmap
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-16 border-t border-zinc-800/50">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid md:grid-cols-5 gap-8 mb-12">
            <div className="md:col-span-2">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-lg bg-fuchsia-500 flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                  </svg>
                </div>
                <span className="text-lg font-semibold">Hardwave Studios</span>
              </div>
              <p className="text-sm text-zinc-500 max-w-xs">
                Professional audio tools for electronic music producers.
              </p>
            </div>

            <div>
              <h4 className="text-sm font-medium mb-4">Product</h4>
              <ul className="space-y-3 text-sm text-zinc-400">
                <li><a href="/downloads" className="hover:text-white transition-colors">Downloads</a></li>
                <li><a href="/roadmap" className="hover:text-white transition-colors">Roadmap</a></li>
                <li><a href="#pricing" className="hover:text-white transition-colors">Pricing</a></li>
              </ul>
            </div>

            <div>
              <h4 className="text-sm font-medium mb-4">Account</h4>
              <ul className="space-y-3 text-sm text-zinc-400">
                <li><a href="/login" className="hover:text-white transition-colors">Sign in</a></li>
                <li><a href="/register" className="hover:text-white transition-colors">Register</a></li>
                <li><a href="/dashboard" className="hover:text-white transition-colors">Dashboard</a></li>
              </ul>
            </div>

            <div>
              <h4 className="text-sm font-medium mb-4">Legal</h4>
              <ul className="space-y-3 text-sm text-zinc-400">
                <li><a href="/privacy" className="hover:text-white transition-colors">Privacy</a></li>
                <li><a href="/terms" className="hover:text-white transition-colors">Terms</a></li>
              </ul>
            </div>
          </div>

          <div className="pt-8 border-t border-zinc-800/50 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-sm text-zinc-500">&copy; 2026 Hardwave Studios. All rights reserved.</p>
            <p className="text-sm text-zinc-600">Design Concept C: Linear Meets Rave</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

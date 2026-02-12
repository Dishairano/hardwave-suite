import { Button } from './Button'

interface SubscriptionRequiredProps {
  email: string
  onLogout: () => void
}

export function SubscriptionRequired({ email, onLogout }: SubscriptionRequiredProps) {
  const handleSubscribe = () => {
    window.electron.auth.openSubscribe()
  }

  const handleRefresh = () => {
    window.location.reload()
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-bg-primary px-4">
      {/* Icon */}
      <div className="w-24 h-24 mb-6 rounded-full bg-gradient-to-br from-yellow-500/20 to-orange-500/20 flex items-center justify-center">
        <svg className="w-12 h-12 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
          />
        </svg>
      </div>

      {/* Content */}
      <div className="text-center max-w-md">
        <h1 className="text-2xl font-bold text-text-primary mb-3">Subscription Required</h1>
        <p className="text-text-secondary mb-6">
          Hey <span className="text-text-primary">{email}</span>! To access the Hardwave Organizer, you need an active subscription.
        </p>

        {/* Features List */}
        <div className="bg-bg-secondary rounded-xl p-6 mb-6 border border-bg-hover text-left">
          <h3 className="text-sm font-semibold text-text-primary mb-4">What you'll get:</h3>
          <ul className="space-y-3">
            <li className="flex items-start gap-3">
              <svg className="w-5 h-5 text-accent-primary flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span className="text-sm text-text-secondary">
                <strong className="text-text-primary">Unlimited Sample Library</strong> - Organize thousands of samples
              </span>
            </li>
            <li className="flex items-start gap-3">
              <svg className="w-5 h-5 text-accent-primary flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span className="text-sm text-text-secondary">
                <strong className="text-text-primary">Smart BPM Detection</strong> - Automatic tempo analysis
              </span>
            </li>
            <li className="flex items-start gap-3">
              <svg className="w-5 h-5 text-accent-primary flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span className="text-sm text-text-secondary">
                <strong className="text-text-primary">Lightning Fast Search</strong> - Find any sample instantly
              </span>
            </li>
            <li className="flex items-start gap-3">
              <svg className="w-5 h-5 text-accent-primary flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span className="text-sm text-text-secondary">
                <strong className="text-text-primary">All Future Updates</strong> - New features included
              </span>
            </li>
          </ul>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-3">
          <Button variant="primary" onClick={handleSubscribe} className="w-full">
            Subscribe Now
          </Button>
          <Button variant="secondary" onClick={handleRefresh} className="w-full">
            I Already Subscribed - Refresh
          </Button>
        </div>

        <button
          onClick={onLogout}
          className="mt-6 text-text-tertiary text-sm hover:text-text-secondary transition-colors"
        >
          Sign out and use a different account
        </button>
      </div>
    </div>
  )
}

'use client';

interface GreetingHeaderProps {
  firstName: string;
  isVisible?: boolean;
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

function getFormattedDate(): string {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

/** Date line + personalised greeting + animated hairline above the card row. */
export function GreetingHeader({ firstName, isVisible = false }: GreetingHeaderProps) {
  const vis = isVisible ? ' is-visible' : '';
  return (
    <div className="flex-shrink-0">
      <p
        className={`pw-eyebrow pw-entry${vis}`}
        style={{ transitionDelay: '0ms' }}
      >
        {getFormattedDate()}
      </p>
      <h1
        className={`pw-entry${vis}`}
        style={{
          fontFamily: 'var(--pw-font-display)',
          fontSize: '34px',
          fontWeight: 400,
          color: 'var(--pw-ink)',
          lineHeight: 1.15,
          marginTop: 4,
          transitionDelay: '60ms',
        }}
      >
        {getGreeting()},{' '}
        <em style={{ fontStyle: 'italic' }}>{firstName}.</em>
      </h1>
      <hr
        className={`pw-rule-reveal${vis}`}
        style={{ marginTop: 12, transitionDelay: '120ms' }}
      />
    </div>
  );
}

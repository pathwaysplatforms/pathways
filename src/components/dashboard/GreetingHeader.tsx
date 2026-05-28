'use client';

interface GreetingHeaderProps {
  firstName: string;
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

/** Date line + personalised greeting above the card row. */
export function GreetingHeader({ firstName }: GreetingHeaderProps) {
  return (
    <div className="flex-shrink-0">
      <p
        className="text-text-tertiary uppercase tracking-widest font-semibold"
        style={{ fontSize: '11px', letterSpacing: '0.08em' }}
      >
        {getFormattedDate()}
      </p>
      <h1
        className="text-text-primary font-extrabold tracking-tight leading-tight mt-1"
        style={{ fontSize: '26px' }}
      >
        {getGreeting()},{' '}
        <span className="text-accent-500">{firstName}.</span>
      </h1>
    </div>
  );
}

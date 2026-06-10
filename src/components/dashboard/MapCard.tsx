import { GlobeCanvas } from '@/components/GlobeCanvas';

interface MapCardProps {
  originCity?: string;
  destinationCity?: string;
  destinationCountry?: string;
  estimatedDate?: string;
}

/**
 * Journey card: dark ink background with interactive globe canvas.
 * Route labels overlaid at the bottom.
 */
export function MapCard({
  originCity = 'Mumbai',
  destinationCity = 'Toronto',
  estimatedDate = '2026',
}: MapCardProps) {
  return (
    <div
      className="flex-1 min-h-0 rounded-xl overflow-hidden relative flex flex-col items-center justify-center"
      style={{ background: 'var(--pw-ink)', minHeight: 220 }}
    >
      <GlobeCanvas />

      {/* Route label overlay */}
      <div
        className="absolute bottom-0 left-0 right-0 flex items-end justify-between pointer-events-none"
        style={{ padding: '0 20px 16px' }}
      >
        <div>
          <p
            style={{
              fontFamily: 'var(--pw-font-body)',
              fontSize: 9,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: 'rgba(255,255,255,0.40)',
              marginBottom: 2,
            }}
          >
            Origin
          </p>
          <p
            style={{
              fontFamily: 'var(--pw-font-display)',
              fontSize: 18,
              fontWeight: 400,
              color: '#fff',
            }}
          >
            {originCity}
          </p>
        </div>

        <p
          style={{
            fontFamily: 'var(--pw-font-display)',
            fontSize: 22,
            fontWeight: 400,
            color: 'var(--pw-accent)',
            paddingBottom: 2,
          }}
        >
          →
        </p>

        <div style={{ textAlign: 'right' }}>
          <p
            style={{
              fontFamily: 'var(--pw-font-body)',
              fontSize: 9,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: 'rgba(255,255,255,0.40)',
              marginBottom: 2,
            }}
          >
            Destination
          </p>
          <p
            style={{
              fontFamily: 'var(--pw-font-display)',
              fontSize: 18,
              fontWeight: 400,
              color: '#fff',
            }}
          >
            {destinationCity}
          </p>
        </div>

        <div style={{ textAlign: 'right' }}>
          <p
            style={{
              fontFamily: 'var(--pw-font-body)',
              fontSize: 9,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: 'rgba(255,255,255,0.40)',
              marginBottom: 2,
            }}
          >
            Est.
          </p>
          <p
            style={{
              fontFamily: 'var(--pw-font-body)',
              fontSize: 13,
              fontWeight: 500,
              color: 'rgba(255,255,255,0.70)',
            }}
          >
            {estimatedDate}
          </p>
        </div>
      </div>
    </div>
  );
}

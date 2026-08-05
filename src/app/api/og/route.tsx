import { ImageResponse } from 'next/og';

// Next 16 deprecates the edge runtime; nodejs keeps this statically analysable.
export const runtime = 'nodejs';

/** The card that shows up in a WhatsApp or Instagram DM. */
export function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const label = searchParams.get('l') ?? 'Something delicious';
  const emoji = searchParams.get('e') ?? '🍽️';

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#fffaf3',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ fontSize: 140, marginBottom: 24 }}>{emoji}</div>
        <div
          style={{
            fontSize: 82,
            fontWeight: 700,
            color: '#d9480f',
            letterSpacing: '-0.03em',
            textAlign: 'center',
            padding: '0 80px',
          }}
        >
          {label}
        </div>
        <div style={{ fontSize: 30, color: '#9a8a80', marginTop: 30 }}>
          my food identity on Fumble
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}

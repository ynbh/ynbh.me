import { ImageResponse } from 'next/og'

const size = {
  width: 1200,
  height: 630,
}

const limits = {
  title: 110,
  description: 170,
}

function clip(value: string, limit: number) {
  if (value.length <= limit) return value
  return value.slice(0, limit - 1).trimEnd() + '…'
}

export async function renderOgImage({
  title,
  description,
  eyebrow = 'ynbh.me',
}: {
  title: string
  description?: string
  eyebrow?: string
}) {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          background:
            'radial-gradient(circle at 95% 10%, #d8e8ff 0, #d8e8ff 18%, #f4f8ff 40%, #fcfcfc 72%)',
          color: '#1c2433',
          padding: 36,
        }}
      >
        <div
          style={{
            position: 'relative',
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            borderRadius: 26,
            border: '1px solid #cfd8e6',
            background: 'rgba(255,255,255,0.9)',
            overflow: 'hidden',
            padding: '42px 48px',
          }}
        >
          <div
            style={{
              position: 'absolute',
              right: -120,
              top: -120,
              width: 380,
              height: 380,
              borderRadius: 380,
              background:
                'radial-gradient(circle at center, rgba(96,137,188,0.18) 0, rgba(96,137,188,0) 68%)',
            }}
          />

          <div
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontFamily: 'ui-monospace',
              fontSize: 26,
              color: '#5f6672',
              letterSpacing: 0.4,
            }}
          >
            <div style={{ display: 'flex' }}>{clip(eyebrow, 30)}</div>
            <div style={{ display: 'flex' }}>Yashas Bhat</div>
          </div>

          <div
            style={{
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              gap: 20,
              maxWidth: '93%',
            }}
          >
            <div
              style={{
                display: 'flex',
                fontFamily: 'ui-sans-serif',
                fontWeight: 600,
                fontSize: 66,
                lineHeight: 1.06,
                letterSpacing: -1.6,
              }}
            >
              {clip(title, limits.title)}
            </div>
            {description ? (
              <div
                style={{
                  display: 'flex',
                  fontFamily: 'ui-sans-serif',
                  fontSize: 30,
                  lineHeight: 1.28,
                  color: '#47556d',
                  letterSpacing: -0.2,
                }}
              >
                {clip(description, limits.description)}
              </div>
            ) : null}
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontFamily: 'ui-monospace',
              fontSize: 24,
              color: '#8a96aa',
              letterSpacing: 0.6,
            }}
          >
            <div style={{ display: 'flex' }}>Software · Systems · Tools</div>
            <div style={{ display: 'flex' }}>ynbh.me</div>
          </div>
        </div>
      </div>
    ),
    { ...size }
  )
}

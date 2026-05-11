import { ImageResponse } from 'next/og'

const size = {
  width: 1200,
  height: 630,
}

const limits = {
  title: 90,
  description: 170,
  eyebrow: 30,
  meta: 60,
  foot: 40,
}

function clip(value: string, limit: number) {
  if (value.length <= limit) return value
  return value.slice(0, limit - 1).trimEnd() + '…'
}

type FontDef = {
  name: string
  data: ArrayBuffer
  weight: number
  style: 'normal' | 'italic'
}

let cachedFonts: FontDef[] | null = null

async function loadFonts(): Promise<FontDef[]> {
  if (cachedFonts) return cachedFonts

  // Satori rejects woff2, variable fonts, and some OpenType features (Geist).
  // Inter / JetBrains Mono / Lora are proven to work. Google Fonts returns
  // plain TTF when no browser User-Agent is present.
  const [inter600, jbMono400, lora500i] = await Promise.all([
    fetchGoogleFont('Inter', 600),
    fetchGoogleFont('JetBrains+Mono', 400),
    fetchGoogleFont('Lora:ital,wght@1,500'),
  ])

  cachedFonts = [
    { name: 'Inter', data: inter600, weight: 600, style: 'normal' },
    { name: 'JBMono', data: jbMono400, weight: 400, style: 'normal' },
    { name: 'Lora', data: lora500i, weight: 500, style: 'italic' },
  ]
  return cachedFonts
}

async function fetchGoogleFont(spec: string, weight?: number): Promise<ArrayBuffer> {
  const param = weight != null ? `${spec}:wght@${weight}` : spec
  const css = await fetch(
    `https://fonts.googleapis.com/css2?family=${param}&display=swap`
  ).then((r) => r.text())
  const match = css.match(/url\(([^)]+)\)/)
  if (!match) throw new Error(`Could not extract font URL from Google Fonts CSS for ${spec}`)
  return fetch(match[1]).then((r) => r.arrayBuffer())
}

export async function renderOgImage({
  eyebrow = 'ynbh.me',
  meta,
  title,
  accent,
  description,
  footLeft,
  footRight = 'ynbh.me',
}: {
  eyebrow?: string
  meta?: string
  title: string
  accent?: string
  description?: string
  footLeft?: string
  footRight?: string
}) {
  const fonts = await loadFonts()

  const clippedTitle = clip(title, limits.title)
  let titleLead = clippedTitle
  let titleAccent = ''
  if (accent && clippedTitle.endsWith(accent)) {
    titleLead = clippedTitle.slice(0, clippedTitle.length - accent.length).trimEnd()
    titleAccent = accent
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: '#07080a',
          color: '#ebedef',
          padding: '80px 88px',
          fontFamily: 'Inter',
        }}
      >
        {/* Eyebrow row */}
        <div
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontFamily: 'JBMono',
            fontSize: 22,
            color: '#697381',
            letterSpacing: 0.4,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: 8,
                background: '#8c95a1',
                marginRight: 14,
              }}
            />
            <div style={{ display: 'flex' }}>
              {clip(eyebrow, limits.eyebrow)}
            </div>
          </div>
          {meta ? (
            <div style={{ display: 'flex' }}>{clip(meta, limits.meta)}</div>
          ) : null}
        </div>

        {/* Title + description */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            maxWidth: '92%',
          }}
        >
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              fontSize: 64,
              fontWeight: 600,
              lineHeight: 1.08,
              letterSpacing: -2,
              color: '#fcfcfc',
            }}
          >
            <div style={{ display: 'flex' }}>{titleLead}</div>
            {titleAccent ? (
              <div
                style={{
                  display: 'flex',
                  fontFamily: 'Lora',
                  fontStyle: 'italic',
                  fontWeight: 500,
                  color: '#d8dbdf',
                  letterSpacing: -1,
                  marginLeft: 18,
                }}
              >
                {titleAccent}
              </div>
            ) : null}
          </div>
          {description ? (
            <div
              style={{
                display: 'flex',
                marginTop: 24,
                fontSize: 26,
                lineHeight: 1.4,
                letterSpacing: -0.3,
                color: '#8c95a1',
              }}
            >
              {clip(description, limits.description)}
            </div>
          ) : null}
        </div>

        {/* Footer row */}
        <div
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontFamily: 'JBMono',
            fontSize: 22,
            color: '#697381',
            letterSpacing: 0.5,
          }}
        >
          <div style={{ display: 'flex' }}>
            {footLeft ? clip(footLeft, limits.foot) : ''}
          </div>
          <div style={{ display: 'flex' }}>{clip(footRight, limits.foot)}</div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts,
    }
  )
}

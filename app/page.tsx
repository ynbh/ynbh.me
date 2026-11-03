import { Row, Rows, Section, ExternalArrow } from '@/components/row'

export const metadata = {
  title: 'Yashas Bhat',
}

const work = [
  {
    logo: '/images/aws-logo.png',
    title: 'Amazon Web Services',
    sub: 'SDE Intern',
    meta: 'Summer 2026',
    desc: 'Enabled software CI for Nitro SSD recovery in the SSD emulator, cutting a 5–6 hour hardware-rig pass to ~8 minutes.',
  },
  {
    logo: '/images/cnh-logo.png',
    title: 'Children’s National Hospital',
    sub: 'Student Developer',
    meta: '2024 – 2025',
    desc: 'Architected TrachSense and the backend behind TrachHub: a CO2-to-mobile alert pipeline with sub-second delivery.',
  },
  {
    logo: '/images/bpcl-logo.png',
    title: 'Bharat Petroleum',
    sub: 'SWE Intern',
    meta: 'Winter 2024',
    desc: 'Built an anomaly-detection pipeline that flagged 950+ potentially fraudulent distributors across 320K+ transactions.',
  },
  {
    logo: '/images/kuiper-logo.png',
    title: 'Amazon Project Kuiper',
    sub: 'Student Developer',
    meta: 'Spring 2024',
    desc: 'Engineered 3 core APIs and the backend for a Space Safety Visualizer used by 10+ satellite operators.',
  },
]

const projects = [
  { title: 'Canvas MCP', sub: 'Canvas LMS data for AI clients, 25+ tools', meta: 'Python', href: 'https://github.com/ynbh/canvasmcp' },
  { title: 'lc', sub: 'LeetCode workflow from the terminal', meta: 'Rust', href: 'https://github.com/ynbh/lc' },
  { title: 'Piazza CLI', sub: 'Read Piazza feeds and search posts locally', meta: 'Rust', href: 'https://github.com/ynbh/piazza-cli' },
  { title: 'Codexport', sub: 'Browse and export Codex sessions to Markdown', meta: 'Rust', href: 'https://github.com/ynbh/codexport' },
  { title: 'Know', sub: 'Hybrid local semantic search, Chroma + BM25', meta: 'Python', href: 'https://github.com/ynbh/know' },
  { title: 'Walker', sub: 'Concurrent link validator, 500+ links in <10s', meta: 'Rust', href: 'https://github.com/ynbh/walker' },
]

const skills: [string, string][] = [
  ['Languages', 'Python, Rust, TypeScript, Java, SQL, OCaml, C/C++'],
  ['Frameworks', 'FastAPI, Axum, Tokio, Next.js, React, FastMCP'],
  ['AI & data', 'LlamaIndex, Chroma, scikit-learn, OpenAI/Gemini APIs'],
  ['Infra', 'Docker, Linux, AWS, Git, Raspberry Pi'],
]

export default function Page() {
  return (
    <div className='enter'>
      <div className='max-w-[65ch]'>
        <p>
          CS student at UMD, graduating in 2027. Previously an SDE intern at
          AWS on the Nitro SSD team, summer ’26.
        </p>
        <p className='mt-3'>
          I work on low-level software, backend systems, dev tools, and AI
          workflows, and I’m a big believer in using agents to do more.
        </p>
        <div className='mt-5 flex flex-wrap gap-x-[18px] gap-y-1 text-[13px]'>
          <a className='link' href='/resume.pdf' target='_blank'>
            Resume
            <ExternalArrow />
          </a>
          <a className='link' href='https://github.com/ynbh' target='_blank' rel='noopener noreferrer'>
            GitHub
            <ExternalArrow />
          </a>
          <a className='link' href='https://www.linkedin.com/in/yashasnbhat' target='_blank' rel='noopener noreferrer'>
            LinkedIn
            <ExternalArrow />
          </a>
          <a className='link' href='mailto:ybhat@umd.edu'>
            Email
          </a>
        </div>
      </div>

      <Section label='Work'>
        <Rows>
          {work.map((w) => (
            <Row key={w.title} {...w} />
          ))}
        </Rows>
      </Section>

      <Section label='Projects'>
        <Rows>
          {projects.map((p) => (
            <Row key={p.title} {...p} />
          ))}
        </Rows>
        <a href='/projects' className='link mt-3 inline-block text-[13px] text-ink3'>
          All projects
        </a>
      </Section>

      <Section label='Writing'>
        <Rows>
          <Row
            href='/thoughts/minimax'
            title='Minimax for Tic Tac Toe'
            sub='Building a game-playing agent'
            meta='Dec 2025'
          />
        </Rows>
      </Section>

      <Section label='Skills'>
        <dl className='grid grid-cols-[96px_1fr] gap-x-4 gap-y-2 text-[14px]'>
          {skills.map(([k, v]) => (
            <div key={k} className='contents'>
              <dt className='pt-px text-[13px] text-ink3'>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section label='Education'>
        <Rows>
          <Row
            logo='/images/umd-logo.png'
            title='University of Maryland'
            sub='B.S. Computer Science, Math minor'
            meta='2027'
          />
        </Rows>
      </Section>
    </div>
  )
}

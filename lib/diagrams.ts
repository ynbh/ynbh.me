/** Mermaid sources drawn by Pele. Labels stay short so a row fits the text column. */
export const diagrams = {
  'canvas-mcp': `flowchart TD
  client[LLM client] -->|MCP| server[Canvas MCP]
  auth[cookie · session · token] --> server
  server --> tools[assignments · grades · calendar]
  tools --> api[Canvas API]`,

  lc: `flowchart LR
  cli[lc] --> file[solution file]
  file --> judge[test · run · submit]
  session[browser session] --> judge`,

  'piazza-cli': `flowchart LR
  browser[browser] --> session[session.json]
  session --> cli[piazza]
  cli --> out[feed · thread]`,

  testudot: `flowchart LR
  job[schedule check] --> diff[state diff]
  diff --> store[(saved state)]
  diff --> alert[HTML alert]`,

  know: `flowchart LR
  files[files] --> idx[Chroma + BM25]
  query[query] --> idx
  idx --> rrf[RRF]
  rrf --> hits[ranked hits]`,

  walker: `flowchart LR
  root[root URL] --> kind{same host?}
  kind -->|yes| crawl[crawl]
  kind -->|no| head[HEAD]
  crawl --> report[report]
  head --> report`,

  tsr: `flowchart LR
  input[file or URL] --> ffmpeg[ffmpeg]
  ffmpeg --> whisper[whisper.cpp]
  whisper --> out[srt · json · text]`,

  codexport: `flowchart LR
  db[(Codex SQLite)] --> read[codexport]
  read --> ui[local UI]
  read --> md[Markdown]`,

  'planet-terp': `flowchart LR
  code[Python] --> client[planet-terp-client]
  client --> api[PlanetTerp]`,

  watch: `flowchart LR
  tui[Textual TUI] --> tmdb[TMDB]
  tmdb --> play[playback]`,

  rename: `flowchart LR
  dir[directory] --> model[model]
  model --> names[new names]`,

  'snippet-verse': `flowchart LR
  code[snippet] --> url[encoded URL]
  url --> view[viewer]`,

  'nitro-ssd': `flowchart LR
  ci[CI] --> emu[SSD emulator]
  emu --> fault[fault injection]
  emu --> reset[live reset]`,

  trachsense: `flowchart LR
  sensor[CO2 sensor] --> pi[Raspberry Pi]
  pi -->|WebSocket| app[mobile alert]`,

  bpcl: `flowchart LR
  tx[transactions] --> dbscan[DBSCAN]
  tx --> forest[Isolation Forest]
  dbscan --> flag[950+ flagged]
  forest --> flag`,

  kuiper: `flowchart LR
  api[collision · registration · sync] --> app[FastAPI]
  app --> pg[(PostgreSQL)]
  app --> chain[Hyperledger]`,

  minimax: `flowchart TD
  pos[position] --> done{over?}
  done -->|X wins| win["+10 − depth"]
  done -->|O wins| loss["−10 + depth"]
  done -->|draw| zero[0]
  done -->|else| turn[max if X, min if O]`,
} as const

export type DiagramName = keyof typeof diagrams

export const diagramLabels: Record<DiagramName, string> = {
  'canvas-mcp': 'Canvas MCP sits between an LLM client and the Canvas API',
  lc: 'lc edits a solution locally, then judges it with the browser session',
  'piazza-cli': 'Piazza CLI reuses a browser session to read the feed',
  testudot: 'Testudot diffs a course snapshot and emails what changed',
  know: 'Know retrieves from Chroma and BM25, then fuses the lists',
  walker: 'Walker crawls links on the same host and checks the rest',
  tsr: 'tsr decodes media with ffmpeg and transcribes it with whisper.cpp',
  codexport: 'Codexport reads Codex sessions into a local UI or Markdown',
  'planet-terp': 'A typed Python client in front of the PlanetTerp API',
  watch: 'Watch searches TMDB, then starts playback',
  rename: 'Rename asks a model for better filenames',
  'snippet-verse': 'Snippet-Verse stores the snippet in the URL',
  'nitro-ssd': 'CI runs fault injection and live reset on an SSD emulator',
  trachsense: 'A CO2 reading is classified on a Pi and pushed to a phone',
  bpcl: 'DBSCAN and Isolation Forest flag the same transaction set',
  kuiper: 'Three Kuiper APIs on FastAPI, with Postgres and Hyperledger',
  minimax: 'A finished position is scored; otherwise X maximizes and O minimizes',
}

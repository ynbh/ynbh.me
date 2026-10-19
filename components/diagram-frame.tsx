'use client'

import { useEffect, useRef, useState } from 'react'
import { mount, register } from 'pele/core'
import flowchart from 'pele/diagrams/flowchart'

register(flowchart)

const mountOptions = {
  fontSize: 14,
  padding: 6,
  directionBreakpoint: 480,
  zoom: false,
} as const

export function DiagramFrame({
  source,
  svg,
  label,
}: {
  source: string
  svg: string
  label: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  // Captured once. Later renders keep this string, so React does not
  // overwrite the SVG after mount() takes ownership of the element.
  const [html] = useState(svg)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const diagram = mount(el, source, mountOptions)
    return () => diagram.destroy()
  }, [source])

  return (
    <figure className='diagram' aria-label={label}>
      <div ref={ref} dangerouslySetInnerHTML={{ __html: html }} />
    </figure>
  )
}

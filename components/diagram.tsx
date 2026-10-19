import { register, render } from 'pele/core'
import flowchart from 'pele/diagrams/flowchart'
import { DiagramFrame } from '@/components/diagram-frame'
import { diagramLabels, diagrams, type DiagramName } from '@/lib/diagrams'

register(flowchart)

export function Diagram({ name }: { name: DiagramName }) {
  const source = diagrams[name]
  const { svg } = render(source, {
    fontSize: 14,
    padding: 6,
    maxWidth: 560,
    directionBreakpoint: 480,
    fontFamily: 'ui-sans-serif, system-ui, sans-serif',
    idPrefix: `diagram-${name}`,
  })

  return <DiagramFrame source={source} svg={svg} label={diagramLabels[name]} />
}

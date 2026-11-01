/** Tech used on a project, as quiet meta text rather than chips. */
export function SkillChips({ skills }: { skills: string[] }) {
  return (
    <p className='meta mt-3 text-ink3'>
      {skills.join(' · ')}
    </p>
  )
}

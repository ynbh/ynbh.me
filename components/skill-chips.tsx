'use client'

interface SkillChipProps {
    children: React.ReactNode
}

export function SkillChip({ children }: SkillChipProps) {
    return (
        <span className="inline-block px-2 py-0.5 text-xs font-medium bg-rurikon-100/60 text-rurikon-600 rounded-full mr-1.5 mb-1.5">
            {children}
        </span>
    )
}

export function SkillChips({ skills }: { skills: string[] }) {
    return (
        <div className="flex flex-wrap mt-2">
            {skills.map((skill) => (
                <SkillChip key={skill}>{skill}</SkillChip>
            ))}
        </div>
    )
}

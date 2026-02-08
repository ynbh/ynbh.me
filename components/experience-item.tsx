interface ExperienceItemProps {
    logo: string
    alt: string
    company: string
    role: string
    date: string
    className?: string
}

export function ExperienceItem({ logo, alt, company, role, date, className = '' }: ExperienceItemProps) {
    return (
        <div className={`flex items-center gap-2.5 mb-2 ${className}`}>
            <img
                src={logo}
                alt={alt}
                width={20}
                height={20}
                className="rounded shrink-0"
                style={{ marginTop: 0, marginBottom: 0 }}
            />
            <span className="leading-snug">
                <strong>{company}</strong> · {role} · <em>{date}</em>
            </span>
        </div>
    )
}

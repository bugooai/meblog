interface TechStackProps {
  tags: string[];
}

// Color palette for tags
const TAG_COLORS = [
  'bg-[var(--color-primary)]/12 text-[var(--color-primary)] border border-[var(--color-primary)]/25',
  'bg-[var(--color-primary)]/16 text-[var(--color-primary-hover)] border border-[var(--color-primary)]/30',
  'bg-[var(--color-background-secondary)] text-[var(--color-foreground-secondary)] border border-[var(--color-border)]',
  'bg-[var(--color-primary-light)]/28 text-[var(--color-foreground)] border border-[var(--color-border)]',
];

function getTagColor(index: number) {
  return TAG_COLORS[index % TAG_COLORS.length];
}

export default function TechStack({ tags }: TechStackProps) {
  if (!tags || tags.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap justify-center gap-2">
      {tags.map((tag, index) => (
        <span
          key={index}
          className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all hover:scale-105 ${getTagColor(index)}`}
        >
          {tag}
        </span>
      ))}
    </div>
  );
}

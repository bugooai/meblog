import Link from 'next/link';

interface RouteNotFoundProps {
  icon: string;
  title: string;
  description: string;
  backHref?: string;
  backLabel?: string;
}

export default function RouteNotFound({
  icon,
  title,
  description,
  backHref = '/',
  backLabel = '返回首页',
}: RouteNotFoundProps) {
  return (
    <div className="text-center py-16">
      <div className="text-6xl mb-4">{icon}</div>
      <h2 className="text-2xl font-semibold text-[var(--color-foreground)] mb-2">{title}</h2>
      <p className="text-[var(--color-foreground-secondary)] mb-6">{description}</p>
      <Link
        href={backHref}
        className="inline-block px-4 py-2 rounded-[8px] bg-[var(--color-primary)] text-white hover:opacity-90 transition-opacity"
      >
        {backLabel}
      </Link>
    </div>
  );
}

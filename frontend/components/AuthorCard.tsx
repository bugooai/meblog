interface AuthorCardProps {
  username: string;
  avatar_url: string | null;
  bio: string | null;
}

export default function AuthorCard({ username, avatar_url, bio }: AuthorCardProps) {
  return (
    <div className="flex flex-col items-center text-center">
      {/* Avatar */}
      <div className="relative">
        {avatar_url ? (
          <img
            src={avatar_url}
            alt={username}
            className="w-28 h-28 rounded-full object-cover ring-4 ring-[var(--color-primary)]/20 shadow-lg"
          />
        ) : (
          <div className="w-28 h-28 rounded-full bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-hover)] flex items-center justify-center text-white text-4xl font-bold shadow-lg ring-4 ring-[var(--color-primary)]/20">
            {username.charAt(0).toUpperCase()}
          </div>
        )}
      </div>

      {/* Username */}
      <h1 className="mt-4 text-2xl font-bold text-[var(--color-foreground)]" style={{ fontFamily: '"Plus Jakarta Sans", sans-serif' }}>
        {username}
      </h1>

      {/* Bio */}
      {bio && (
        <p className="mt-2 text-[var(--color-foreground-secondary)] max-w-md leading-relaxed">
          {bio}
        </p>
      )}
    </div>
  );
}

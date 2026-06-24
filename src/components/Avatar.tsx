import { useState, useEffect } from 'react';
import { SUPABASE_URL } from '../lib/api';

const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

const COLORS = [
  'from-blue-500 to-cyan-500',
  'from-violet-500 to-purple-500',
  'from-emerald-500 to-teal-500',
  'from-orange-500 to-amber-500',
  'from-rose-500 to-pink-500',
  'from-indigo-500 to-blue-500',
];

function colorFor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xfffffff;
  return COLORS[h % COLORS.length];
}

interface AvatarProps {
  userId?: number;
  avatarUrl?: string | null;
  name: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const SIZES = {
  xs: 'w-6 h-6 text-xs',
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-14 h-14 text-lg',
  xl: 'w-20 h-20 text-2xl',
};

export default function Avatar({ userId, avatarUrl, name, size = 'md', className = '' }: AvatarProps) {
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    setError(false);
    if (!avatarUrl && !userId) { setResolvedUrl(null); return; }

    const url = avatarUrl || '';

    // Real CDN URL - use directly
    if (url && (url.includes('rbxcdn.com') || url.includes('roblox.com/thumbnails'))) {
      setResolvedUrl(url);
      return;
    }

    // Thumbnail API URL or no URL - resolve via proxy
    if (userId) {
      fetch(`${SUPABASE_URL}/functions/v1/roblox-api/avatar/${userId}`, {
        headers: { Authorization: `Bearer ${KEY}`, Apikey: KEY },
      })
        .then(r => r.json())
        .then(d => { if (d.url) setResolvedUrl(d.url); else setResolvedUrl(null); })
        .catch(() => setResolvedUrl(null));
    } else {
      setResolvedUrl(null);
    }
  }, [avatarUrl, userId]);

  const sizeClass = SIZES[size];
  const initials = (name || '?')[0].toUpperCase();
  const color = colorFor(name || '');

  if (resolvedUrl && !error) {
    return (
      <div className={`${sizeClass} rounded-full overflow-hidden shrink-0 ${className}`}>
        <img
          src={resolvedUrl}
          alt={name}
          className="w-full h-full object-cover"
          onError={() => setError(true)}
        />
      </div>
    );
  }

  return (
    <div className={`${sizeClass} rounded-full bg-gradient-to-br ${color} flex items-center justify-center font-bold text-white shrink-0 ${className}`}>
      {initials}
    </div>
  );
}

import { useState, useEffect } from 'react';
import { createClient } from '@metagptx/web-sdk';
import { type BrandProfile as BrandProfileType } from '@/lib/briefTypes';
import { Building2, Palette, Type, MessageSquare, Loader2 } from 'lucide-react';

const client = createClient();

interface BrandProfileProps {
  onSelectBrand?: (brand: BrandProfileType) => void;
  selectedBrandId?: number;
}

export default function BrandProfile({ onSelectBrand, selectedBrandId }: BrandProfileProps) {
  const [profiles, setProfiles] = useState<BrandProfileType[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProfiles = async () => {
      try {
        const res = await client.entities.brand_profiles.query({ query: {}, limit: 20 });
        setProfiles((res?.data?.items as BrandProfileType[]) || []);
      } catch {
        setProfiles([]);
      } finally {
        setLoading(false);
      }
    };
    fetchProfiles();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-violet-400" />
      </div>
    );
  }

  if (profiles.length === 0) {
    return (
      <div className="rounded-xl border border-white/10 bg-[#13131a] p-4 text-center">
        <p className="text-sm text-slate-400">No brand profiles yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
        <Building2 className="h-4 w-4 text-violet-400" />
        Brand Profiles
      </h3>
      {profiles.map((profile) => (
        <button
          key={profile.id}
          onClick={() => onSelectBrand?.(profile)}
          className={`w-full rounded-xl border p-4 text-left transition-all duration-200 ${
            selectedBrandId === profile.id
              ? 'border-violet-500/50 bg-violet-500/10 shadow-lg shadow-violet-500/5'
              : 'border-white/10 bg-[#13131a] hover:border-white/20 hover:bg-white/5'
          }`}
        >
          <div className="mb-3 flex items-center justify-between">
            <h4 className="font-semibold text-white">{profile.brand_name}</h4>
            <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-slate-400">
              {profile.industry}
            </span>
          </div>

          {profile.tagline && (
            <p className="mb-3 text-xs italic text-slate-400">"{profile.tagline}"</p>
          )}

          <div className="mb-3 flex gap-2">
            {[profile.primary_color, profile.secondary_color, profile.accent_color]
              .filter(Boolean)
              .map((color, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <div
                    className="h-4 w-4 rounded-full border border-white/20"
                    style={{ backgroundColor: color }}
                  />
                  <span className="text-xs text-slate-500">{color}</span>
                </div>
              ))}
          </div>

          <div className="space-y-1.5">
            {profile.font_heading && (
              <div className="flex items-center gap-1.5 text-xs text-slate-400">
                <Type className="h-3 w-3" />
                <span>{profile.font_heading} / {profile.font_body}</span>
              </div>
            )}
            {profile.tone_of_voice && (
              <div className="flex items-center gap-1.5 text-xs text-slate-400">
                <MessageSquare className="h-3 w-3" />
                <span>{profile.tone_of_voice}</span>
              </div>
            )}
            {profile.guidelines_notes && (
              <div className="flex items-center gap-1.5 text-xs text-slate-400">
                <Palette className="h-3 w-3" />
                <span className="line-clamp-2">{profile.guidelines_notes}</span>
              </div>
            )}
          </div>
        </button>
      ))}
    </div>
  );
}
'use client';

import { useState, useEffect } from 'react';
import { Tag, Search, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { getAllFiles, AudioFile } from '@/lib/pwa/storage';
import { hapticTap } from '@/lib/pwa/haptics';

interface TagData {
  name: string;
  count: number;
}

export default function TagsPage() {
  const [tags, setTags] = useState<TagData[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadTags();
  }, []);

  const loadTags = async () => {
    setIsLoading(true);
    try {
      const files = await getAllFiles();
      const tagCounts: Record<string, number> = {};

      files.forEach((file: AudioFile) => {
        if (file.tags) {
          file.tags.forEach((tag) => {
            tagCounts[tag] = (tagCounts[tag] || 0) + 1;
          });
        }
      });

      const tagList = Object.entries(tagCounts)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count);

      setTags(tagList);
    } catch (err) {
      console.error('Failed to load tags:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredTags = tags.filter((tag) =>
    tag.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Group tags by first letter
  const groupedTags = filteredTags.reduce((acc, tag) => {
    const letter = tag.name[0].toUpperCase();
    if (!acc[letter]) acc[letter] = [];
    acc[letter].push(tag);
    return acc;
  }, {} as Record<string, TagData[]>);

  const sortedLetters = Object.keys(groupedTags).sort();

  return (
    <div className="px-4 pt-4 pb-8">
      {/* Header */}
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Tag className="w-7 h-7 text-[#FFA500]" />
          Tags
        </h1>
        <p className="text-sm text-white/60 mt-1">
          {tags.length} tags in your library
        </p>
      </header>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
        <input
          type="text"
          placeholder="Search tags..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-white/40 outline-none focus:border-[#FFA500]/50 focus:ring-2 focus:ring-[#FFA500]/20"
        />
      </div>

      {/* Tags list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-2 border-[#FFA500] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : tags.length === 0 ? (
        <div className="text-center py-12">
          <Tag className="w-12 h-12 text-white/20 mx-auto mb-3" />
          <p className="text-white/60">No tags found</p>
          <p className="text-sm text-white/40 mt-1">
            Tags are synced from your desktop app
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {sortedLetters.map((letter) => (
            <div key={letter}>
              <h2 className="text-xs font-medium text-white/40 uppercase tracking-wider mb-2 sticky top-0 bg-[#08080c] py-1">
                {letter}
              </h2>
              <div className="space-y-1">
                {groupedTags[letter].map((tag) => (
                  <Link
                    key={tag.name}
                    href={`/app?tag=${encodeURIComponent(tag.name)}`}
                    onClick={() => hapticTap()}
                    className="flex items-center gap-3 p-3 rounded-xl bg-white/5 active:bg-white/10"
                  >
                    <div className="w-10 h-10 rounded-lg bg-[#FFA500]/20 flex items-center justify-center">
                      <Tag className="w-5 h-5 text-[#FFA500]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">
                        {tag.name}
                      </p>
                      <p className="text-xs text-white/40">
                        {tag.count} {tag.count === 1 ? 'file' : 'files'}
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-white/40" />
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Popular tags section */}
      {!isLoading && tags.length > 0 && !searchQuery && (
        <div className="mt-8">
          <h2 className="text-xs font-medium text-white/40 uppercase tracking-wider mb-3">
            Popular Tags
          </h2>
          <div className="flex flex-wrap gap-2">
            {tags.slice(0, 10).map((tag) => (
              <Link
                key={tag.name}
                href={`/app?tag=${encodeURIComponent(tag.name)}`}
                onClick={() => hapticTap()}
                className="px-3 py-1.5 rounded-full bg-[#FFA500]/20 text-[#FFA500] text-sm font-medium active:bg-[#FFA500]/30"
              >
                {tag.name}
                <span className="ml-1 text-[#FFA500]/60">{tag.count}</span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

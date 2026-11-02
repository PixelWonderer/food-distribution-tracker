import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useOpsStore } from '@/services/opsState';
import { KB_CATEGORY_INFO, type KBCategory, type KBArticle } from '@/types/ops';
import { cn } from '@/lib/utils';

/**
 * Knowledge base article listing with category filtering and search
 */
const GuideView: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { articles, fetchArticles, isLoading } = useOpsStore();
  const [searchQuery, setSearchQuery] = useState('');

  const selectedCategory = searchParams.get('category') as KBCategory | null;

  // Fetch articles on mount and when category changes
  useEffect(() => {
    fetchArticles(selectedCategory || undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCategory]);

  // Filter articles by search query
  const filteredArticles = useMemo(() => {
    if (!searchQuery.trim()) return articles;

    const query = searchQuery.toLowerCase();
    return articles.filter(article =>
      article.title.toLowerCase().includes(query) ||
      article.content.toLowerCase().includes(query)
    );
  }, [articles, searchQuery]);

  // Group articles by category
  const groupedArticles = useMemo(() => {
    const groups: Record<string, typeof filteredArticles> = {};

    filteredArticles.forEach(article => {
      const cat = article.category || 'general';
      if (!groups[cat]) {
        groups[cat] = [];
      }
      groups[cat].push(article);
    });

    return groups;
  }, [filteredArticles]);

  // Category filter buttons
  const categories: (KBCategory | 'all')[] = ['all', 'procedures', 'locations', 'routes', 'contacts'];

  const handleCategoryChange = (cat: KBCategory | 'all') => {
    if (cat === 'all') {
      setSearchParams({});
    } else {
      setSearchParams({ category: cat });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Knowledge Base</h1>
          <p className="text-slate-500 mt-1">
            Procedures, locations, routes, and contacts for food operations
          </p>
        </div>
      </div>

      {/* Search bar */}
      <div className="relative">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        <input
          type="text"
          placeholder="Search articles..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Category filter tabs */}
      <div className="flex flex-wrap gap-2">
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => handleCategoryChange(cat)}
            className={cn(
              'px-4 py-2 rounded-lg text-sm font-medium transition-all',
              (cat === 'all' && !selectedCategory) || selectedCategory === cat
                ? 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200'
                : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
            )}
          >
            {cat === 'all' ? (
              '📖 All'
            ) : (
              <>
                {KB_CATEGORY_INFO[cat].icon} {KB_CATEGORY_INFO[cat].name}
              </>
            )}
          </button>
        ))}
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="text-center py-12">
          <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-500">Loading articles...</p>
        </div>
      )}

      {/* Empty state - no articles at all */}
      {!isLoading && articles.length === 0 && (
        <div className="text-center py-12 bg-white rounded-xl border border-slate-200">
          <span className="text-4xl mb-4 block">📭</span>
          <h3 className="text-lg font-semibold text-slate-900 mb-2">No articles yet</h3>
          <p className="text-slate-500 max-w-md mx-auto">
            The knowledge base is being populated. Check back soon for procedures, routes, and more.
          </p>
        </div>
      )}

      {/* No search results */}
      {!isLoading && articles.length > 0 && filteredArticles.length === 0 && searchQuery && (
        <div className="text-center py-12 bg-white rounded-xl border border-slate-200">
          <span className="text-4xl mb-4 block">🔍</span>
          <h3 className="text-lg font-semibold text-slate-900 mb-2">No results found</h3>
          <p className="text-slate-500 max-w-md mx-auto">
            No articles match "{searchQuery}". Try a different search term.
          </p>
          <button
            onClick={() => setSearchQuery('')}
            className="mt-4 text-emerald-600 hover:text-emerald-700 text-sm font-medium"
          >
            Clear search
          </button>
        </div>
      )}

      {/* Articles grouped by category (when no filter) */}
      {!isLoading && !selectedCategory && Object.keys(groupedArticles).length > 0 && (
        <div className="space-y-8">
          {Object.entries(groupedArticles).map(([category, categoryArticles]) => (
            <div key={category}>
              <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <span>{KB_CATEGORY_INFO[category as KBCategory]?.icon || '📄'}</span>
                {KB_CATEGORY_INFO[category as KBCategory]?.name || category}
                <span className="text-sm font-normal text-slate-400">
                  ({categoryArticles.length})
                </span>
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {categoryArticles.map(article => (
                  <ArticleCard key={article.id} article={article} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Articles flat list (when category filtered) */}
      {!isLoading && selectedCategory && filteredArticles.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredArticles.map(article => (
            <ArticleCard key={article.id} article={article} />
          ))}
        </div>
      )}
    </div>
  );
};

// Article preview card
const ArticleCard: React.FC<{ article: KBArticle }> = ({ article }) => {
  // Get first ~100 chars of content as preview (strip markdown)
  const preview = article.content
    .replace(/^#+ .*/gm, '') // Remove headings
    .replace(/\*\*([^*]+)\*\*/g, '$1') // Remove bold
    .replace(/\*([^*]+)\*/g, '$1') // Remove italic
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Remove links
    .replace(/^[-*] /gm, '') // Remove list markers
    .trim()
    .slice(0, 120);

  return (
    <Link
      to={`/ops/guide/${article.slug}`}
      className="block bg-white rounded-xl border border-slate-200 p-4 hover:border-emerald-300 hover:shadow-md transition-all group"
    >
      <div className="flex items-start gap-3">
        <span className="text-2xl">
          {KB_CATEGORY_INFO[article.category as KBCategory]?.icon || '📄'}
        </span>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-slate-900 group-hover:text-emerald-700 transition-colors">
            {article.title}
          </h3>
          {preview && (
            <p className="text-sm text-slate-500 mt-1 line-clamp-2">{preview}...</p>
          )}
        </div>
      </div>
      <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
        <span className="text-slate-400">
          {KB_CATEGORY_INFO[article.category as KBCategory]?.name || article.category}
        </span>
        <span className="text-emerald-600 group-hover:translate-x-1 transition-transform">
          Read →
        </span>
      </div>
    </Link>
  );
};

export default GuideView;

import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useOpsStore } from '@/services/opsState';
import { KB_CATEGORY_INFO, type KBArticle, type KBCategory } from '@/types/ops';

/**
 * Individual article reader with markdown rendering
 */
const ArticleView: React.FC = () => {
  const { articleSlug } = useParams<{ articleSlug: string }>();
  const navigate = useNavigate();
  const { fetchArticleBySlug, articles } = useOpsStore();
  const [article, setArticle] = useState<KBArticle | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadArticle = async () => {
      if (!articleSlug) {
        navigate('/ops/guide');
        return;
      }

      setIsLoading(true);

      // First check if we already have it in store
      const cached = articles.find(a => a.slug === articleSlug);
      if (cached) {
        setArticle(cached);
        setIsLoading(false);
        return;
      }

      // Otherwise fetch from database
      const fetched = await fetchArticleBySlug(articleSlug);
      if (fetched) {
        setArticle(fetched);
      } else {
        // Article not found - redirect to guide
        navigate('/ops/guide');
      }
      setIsLoading(false);
    };

    loadArticle();
  }, [articleSlug, articles, fetchArticleBySlug, navigate]);

  // Simple markdown renderer (basic support)
  const renderMarkdown = (content: string) => {
    // Split into lines for processing
    const lines = content.split('\n');
    const elements: React.ReactNode[] = [];
    let currentList: string[] = [];
    let listType: 'ul' | 'ol' | null = null;

    const flushList = () => {
      if (currentList.length > 0 && listType) {
        const ListTag = listType;
        elements.push(
          <ListTag key={elements.length} className={listType === 'ul' ? 'list-disc' : 'list-decimal'}>
            {currentList.map((item, i) => (
              <li key={i} className="ml-6 mb-1">
                {renderInline(item)}
              </li>
            ))}
          </ListTag>
        );
        currentList = [];
        listType = null;
      }
    };

    lines.forEach((line, index) => {
      // Headers
      if (line.startsWith('### ')) {
        flushList();
        elements.push(
          <h3 key={index} className="text-lg font-semibold text-slate-900 mt-6 mb-3">
            {renderInline(line.slice(4))}
          </h3>
        );
      } else if (line.startsWith('## ')) {
        flushList();
        elements.push(
          <h2 key={index} className="text-xl font-bold text-slate-900 mt-8 mb-4 pb-2 border-b border-slate-200">
            {renderInline(line.slice(3))}
          </h2>
        );
      } else if (line.startsWith('# ')) {
        flushList();
        elements.push(
          <h1 key={index} className="text-2xl font-bold text-slate-900 mt-8 mb-4">
            {renderInline(line.slice(2))}
          </h1>
        );
      }
      // Unordered list
      else if (line.match(/^[-*] /)) {
        if (listType !== 'ul') {
          flushList();
          listType = 'ul';
        }
        currentList.push(line.slice(2));
      }
      // Ordered list
      else if (line.match(/^\d+\. /)) {
        if (listType !== 'ol') {
          flushList();
          listType = 'ol';
        }
        currentList.push(line.replace(/^\d+\. /, ''));
      }
      // Horizontal rule
      else if (line.match(/^---+$/)) {
        flushList();
        elements.push(<hr key={index} className="my-6 border-slate-200" />);
      }
      // Blockquote
      else if (line.startsWith('> ')) {
        flushList();
        elements.push(
          <blockquote
            key={index}
            className="border-l-4 border-emerald-300 bg-emerald-50 pl-4 py-2 my-4 text-slate-700 italic"
          >
            {renderInline(line.slice(2))}
          </blockquote>
        );
      }
      // Empty line
      else if (line.trim() === '') {
        flushList();
      }
      // Regular paragraph
      else {
        flushList();
        elements.push(
          <p key={index} className="text-slate-700 leading-relaxed mb-4">
            {renderInline(line)}
          </p>
        );
      }
    });

    flushList();
    return elements;
  };

  // Inline markdown rendering (bold, italic, links, code)
  const renderInline = (text: string): React.ReactNode => {
    // Process inline elements
    const parts: React.ReactNode[] = [];
    let remaining = text;
    let key = 0;

    while (remaining.length > 0) {
      // Bold
      const boldMatch = remaining.match(/\*\*([^*]+)\*\*/);
      // Italic
      const italicMatch = remaining.match(/\*([^*]+)\*/);
      // Link
      const linkMatch = remaining.match(/\[([^\]]+)\]\(([^)]+)\)/);
      // Inline code
      const codeMatch = remaining.match(/`([^`]+)`/);

      // Find the earliest match
      const matches = [
        boldMatch && { type: 'bold', match: boldMatch, index: boldMatch.index! },
        italicMatch && { type: 'italic', match: italicMatch, index: italicMatch.index! },
        linkMatch && { type: 'link', match: linkMatch, index: linkMatch.index! },
        codeMatch && { type: 'code', match: codeMatch, index: codeMatch.index! },
      ].filter(Boolean) as { type: string; match: RegExpMatchArray; index: number }[];

      if (matches.length === 0) {
        parts.push(remaining);
        break;
      }

      const earliest = matches.reduce((a, b) => (a.index < b.index ? a : b));

      // Add text before match
      if (earliest.index > 0) {
        parts.push(remaining.slice(0, earliest.index));
      }

      // Add matched element
      if (earliest.type === 'bold') {
        parts.push(
          <strong key={key++} className="font-semibold text-slate-900">
            {earliest.match[1]}
          </strong>
        );
      } else if (earliest.type === 'italic') {
        parts.push(
          <em key={key++} className="italic">
            {earliest.match[1]}
          </em>
        );
      } else if (earliest.type === 'link') {
        const href = earliest.match[2];
        // Only http(s), mailto, and relative links become anchors; javascript:/data: render as plain text
        let safe = false;
        try {
          safe = ['http:', 'https:', 'mailto:'].includes(new URL(href, window.location.origin).protocol);
        } catch {
          safe = false;
        }
        const isExternal = href.startsWith('http');
        parts.push(
          safe ? (
            <a
              key={key++}
              href={href}
              target={isExternal ? '_blank' : undefined}
              rel={isExternal ? 'noopener noreferrer' : undefined}
              className="text-emerald-600 hover:text-emerald-700 underline"
            >
              {earliest.match[1]}
            </a>
          ) : (
            <span key={key++}>{earliest.match[1]}</span>
          )
        );
      } else if (earliest.type === 'code') {
        parts.push(
          <code key={key++} className="px-1.5 py-0.5 bg-slate-100 rounded text-sm font-mono text-slate-800">
            {earliest.match[1]}
          </code>
        );
      }

      // Continue with remaining text
      remaining = remaining.slice(earliest.index + earliest.match[0].length);
    }

    return parts;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-500">Loading article...</p>
        </div>
      </div>
    );
  }

  if (!article) {
    return (
      <div className="text-center py-12">
        <span className="text-4xl mb-4 block">📭</span>
        <h3 className="text-lg font-semibold text-slate-900 mb-2">Article not found</h3>
        <Link to="/ops/guide" className="text-emerald-600 hover:text-emerald-700">
          ← Back to Knowledge Base
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl">
      {/* Back link */}
      <Link
        to="/ops/guide"
        className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-emerald-600 mb-6 transition-colors"
      >
        <span>←</span>
        Back to Knowledge Base
      </Link>

      {/* Article header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-2xl">
            {KB_CATEGORY_INFO[article.category as KBCategory]?.icon || '📄'}
          </span>
          <span className="text-sm font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">
            {KB_CATEGORY_INFO[article.category as KBCategory]?.name || article.category}
          </span>
        </div>
        <h1 className="text-3xl font-bold text-slate-900">{article.title}</h1>
        <p className="text-sm text-slate-400 mt-2">
          Last updated: {new Date(article.updated_at).toLocaleDateString()}
        </p>
      </div>

      {/* Article content */}
      <article className="prose prose-slate max-w-none">
        {renderMarkdown(article.content)}
      </article>

      {/* Footer navigation */}
      <div className="mt-12 pt-6 border-t border-slate-200">
        <Link
          to="/ops/guide"
          className="inline-flex items-center gap-2 text-emerald-600 hover:text-emerald-700 font-medium"
        >
          <span>←</span>
          Browse more articles
        </Link>
      </div>
    </div>
  );
};

export default ArticleView;

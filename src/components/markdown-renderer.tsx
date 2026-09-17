"use client";

import React, { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

function MarkdownImage({
  src,
  alt,
}: {
  src?: string;
  alt?: string;
}) {
  const [hasError, setHasError] = useState(false);

  if (!src) return null;

  if (hasError) {
    return (
      <div className="my-3 flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/60 bg-muted/20 p-6 text-center text-xs text-muted-foreground">
        <span className="font-semibold">Unable to load image</span>
        <span className="mt-1 font-mono text-3xs text-muted-foreground/80 break-all">{src}</span>
      </div>
    );
  }

  return (
    <figure className="my-4 flex flex-col items-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt || "Question diagram"}
        onError={() => setHasError(true)}
        loading="lazy"
        className="max-h-[460px] max-w-full rounded-2xl border border-border/40 bg-muted/10 object-contain p-1 shadow-sm transition-all hover:border-border"
      />
      {alt && alt.trim() !== "" && (
        <figcaption className="mt-1.5 text-center text-2xs italic text-muted-foreground">
          {alt}
        </figcaption>
      )}
    </figure>
  );
}

export function MarkdownRenderer({ content, className = "" }: MarkdownRendererProps) {
  if (!content) return null;

  return (
    <div className={`markdown-content text-sm leading-relaxed text-foreground space-y-3 ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          img: ({ src, alt }) => (
            <MarkdownImage src={typeof src === "string" ? src : undefined} alt={alt} />
          ),
          h1: ({ children }) => (
            <h1 className="text-xl font-bold text-foreground mt-4 mb-2 pb-1 border-b border-border/30">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-lg font-bold text-foreground mt-3 mb-1.5">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-base font-semibold text-foreground mt-2.5 mb-1">
              {children}
            </h3>
          ),
          p: ({ children }) => (
            <p className="whitespace-pre-wrap leading-relaxed text-foreground/90">
              {children}
            </p>
          ),
          ul: ({ children }) => (
            <ul className="list-disc list-inside space-y-1 pl-2 text-foreground/90">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal list-inside space-y-1 pl-2 text-foreground/90">
              {children}
            </ol>
          ),
          li: ({ children }) => <li className="leading-relaxed">{children}</li>,
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-primary/40 bg-muted/20 pl-4 py-1.5 my-2 rounded-r-xl italic text-muted-foreground">
              {children}
            </blockquote>
          ),
          code: ({ className: codeClassName, children, ...props }) => {
            const isInline = !codeClassName && typeof children === "string" && !children.includes("\n");
            if (isInline) {
              return (
                <code
                  className="rounded-md bg-muted/60 px-1.5 py-0.5 font-mono text-xs font-semibold text-foreground border border-border/40"
                  {...props}
                >
                  {children}
                </code>
              );
            }
            return (
              <pre className="my-2 overflow-x-auto rounded-xl border border-border/40 bg-muted/30 p-3.5 font-mono text-xs text-foreground">
                <code className={codeClassName} {...props}>
                  {children}
                </code>
              </pre>
            );
          },
          table: ({ children }) => (
            <div className="my-3 overflow-x-auto rounded-xl border border-border/40">
              <table className="w-full text-left text-xs border-collapse">
                {children}
              </table>
            </div>
          ),
          th: ({ children }) => (
            <th className="border-b border-border/40 bg-muted/40 px-3 py-2 font-bold text-foreground">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border-b border-border/20 px-3 py-2 text-foreground/90">
              {children}
            </td>
          ),
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-primary underline underline-offset-4 hover:opacity-80"
            >
              {children}
            </a>
          ),
          hr: () => <hr className="my-4 border-border/40" />,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

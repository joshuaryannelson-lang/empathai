"use client";

import ReactMarkdown from "react-markdown";

type Props = {
  children: string;
  className?: string;
};

export default function MarkdownContent({ children, className }: Props) {
  return (
    <div className={`md-content ${className ?? ""}`}>
      <ReactMarkdown>{children}</ReactMarkdown>
      <style>{`
        .md-content h1, .md-content h2 {
          color: #c8d0e0;
          font-size: 15px;
          font-weight: 800;
          margin: 0 0 6px;
          letter-spacing: -0.02em;
        }
        .md-content h1 { font-size: 16px; }
        .md-content h3 {
          color: #9ca3af;
          font-size: 13px;
          font-weight: 700;
          margin: 0 0 4px;
        }
        .md-content p {
          margin: 0 0 8px;
          line-height: 1.65;
        }
        .md-content p:last-child { margin-bottom: 0; }
        .md-content ul, .md-content ol {
          margin: 0 0 8px;
          padding-left: 20px;
        }
        .md-content li {
          margin-bottom: 4px;
          line-height: 1.6;
        }
        .md-content strong { color: #e2e8f0; font-weight: 700; }
        .md-content em { color: #9ca3af; }
        .md-content code {
          background: rgba(255,255,255,0.06);
          padding: 1px 5px;
          border-radius: 4px;
          font-size: 0.92em;
        }
      `}</style>
    </div>
  );
}

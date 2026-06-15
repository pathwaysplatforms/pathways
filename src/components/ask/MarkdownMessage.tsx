'use client';

import React from 'react';

interface MarkdownMessageProps {
  content: string;
}

/** Parse inline markdown tokens into React nodes. Bare URLs are silently stripped. */
function parseInline(text: string, keyPrefix: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  // Groups: 1=link-wrapper, 2=link-text, 3=link-url, 4=bold-wrapper, 5=bold-text,
  //         6=italic-wrapper, 7=italic-text, 8=bare-url (stripped)
  const regex =
    /(\[([^\]]+)\]\((https?:\/\/[^\s)]+)\))|(\*\*(.+?)\*\*)|(\*(.+?)\*)|(https?:\/\/\S+)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let counter = 0;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    const key = `${keyPrefix}-${counter++}`;

    if (match[1] !== undefined) {
      // [text](url) link
      parts.push(
        <a
          key={key}
          href={match[3] ?? '#'}
          target="_blank"
          rel="noopener noreferrer"
          className="pw-md-link"
        >
          {match[2] ?? ''}
        </a>
      );
    } else if (match[4] !== undefined) {
      // **bold**
      parts.push(
        <strong key={key} className="pw-md-bold">
          {match[5] ?? ''}
        </strong>
      );
    } else if (match[6] !== undefined) {
      // *italic*
      parts.push(<em key={key}>{match[7] ?? ''}</em>);
    }
    // Bare URLs (match[8]) are silently dropped — they belong in the Sources section

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts;
}

/** Renders assistant message content from markdown to React elements without a library. */
export function MarkdownMessage({ content }: MarkdownMessageProps) {
  const blocks = content.split(/\n\n+/);

  return (
    <>
      {blocks.map((block, blockIdx) => {
        const key = `block-${blockIdx}`;
        const lines = block.split('\n');
        const nonEmpty = lines.filter((l) => l.trim().length > 0);

        if (nonEmpty.length === 0) return null;

        // Unordered list — first non-empty line starts with `- ` or `* `
        if (/^[-*]\s/.test(nonEmpty[0])) {
          return (
            <ul key={key} className="pw-md-ul">
              {nonEmpty
                .filter((l) => /^[-*]\s/.test(l))
                .map((line, li) => (
                  <li key={li} className="pw-md-li">
                    {parseInline(line.replace(/^[-*]\s/, ''), `${key}-li-${li}`)}
                  </li>
                ))}
            </ul>
          );
        }

        // Ordered list — first non-empty line starts with `1. ` pattern
        if (/^\d+\.\s/.test(nonEmpty[0])) {
          return (
            <ol key={key} className="pw-md-ol">
              {nonEmpty
                .filter((l) => /^\d+\.\s/.test(l))
                .map((line, li) => (
                  <li key={li} className="pw-md-li">
                    {parseInline(line.replace(/^\d+\.\s/, ''), `${key}-li-${li}`)}
                  </li>
                ))}
            </ol>
          );
        }

        // Bold-only heading — single line wrapped entirely in ** ... **
        const trimmed = block.trim();
        if (
          nonEmpty.length === 1 &&
          trimmed.startsWith('**') &&
          trimmed.endsWith('**') &&
          trimmed.length > 4
        ) {
          return (
            <p key={key} className="pw-md-heading">
              {trimmed.slice(2, -2)}
            </p>
          );
        }

        // Regular paragraph — join lines with space (standard markdown prose reflow)
        return (
          <p key={key} className="pw-md-p">
            {parseInline(lines.join(' '), key)}
          </p>
        );
      })}
    </>
  );
}

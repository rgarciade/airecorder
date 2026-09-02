const DEFAULT_RELEASE_NOTES = 'Mejoras y correcciones.';
const DEFAULT_MAX_LENGTH = 600;

const decodeHtmlEntities = (text) => {
  const decodeCodePoint = (match, code, radix) => {
    const codePoint = parseInt(code, radix);
    const isUnicodeScalar = codePoint > 0
      && codePoint <= 0x10FFFF
      && (codePoint < 0xD800 || codePoint > 0xDFFF);

    return isUnicodeScalar ? String.fromCodePoint(codePoint) : match;
  };

  return text
    .replace(/&#(\d+);/g, (match, code) => decodeCodePoint(match, code, 10))
    .replace(/&#x([\da-f]+);/gi, (match, code) => decodeCodePoint(match, code, 16))
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'");
};

const truncateText = (text, maxLength) => {
  if (text.length <= maxLength) return text;
  if (maxLength <= 1) return '…'.slice(0, maxLength);

  let candidate = text.slice(0, maxLength - 1);
  if (/[\uD800-\uDBFF]$/.test(candidate)) candidate = candidate.slice(0, -1);
  candidate = candidate.trimEnd();
  const minimumBoundary = Math.floor(candidate.length * 0.6);
  const sentenceMatches = [...candidate.matchAll(/[.!?](?=\s|$)/g)];
  const boundaries = [
    candidate.lastIndexOf('\n'),
    sentenceMatches.at(-1)?.index + 1 || -1,
    candidate.lastIndexOf(' '),
  ].filter((index) => index >= minimumBoundary);
  const boundary = boundaries.length ? Math.max(...boundaries) : candidate.length;

  return `${candidate.slice(0, boundary).trimEnd()}…`;
};

const formatReleaseNotes = (markdown, maxLength = DEFAULT_MAX_LENGTH) => {
  if (typeof markdown !== 'string' || !markdown.trim()) {
    return truncateText(DEFAULT_RELEASE_NOTES, maxLength);
  }

  const autolinks = [];
  let text = markdown
    .replace(/\r\n?/g, '\n')
    .replace(/<!--[^]*?-->/g, '')
    .replace(/<((?:https?:\/\/|mailto:)[^>]+)>/gi, (_match, link) => {
      const placeholder = `\0AUTOLINK_${autolinks.length}\0`;
      autolinks.push(link);
      return placeholder;
    })
    .replace(/<\/?(?:address|article|aside|blockquote|details|dialog|div|dl|dt|dd|fieldset|figcaption|figure|footer|form|h[1-6]|header|hr|li|main|nav|ol|p|pre|section|summary|table|thead|tbody|tfoot|tr|ul|br)\b[^>]*>/gi, '\n')
    .replace(/<\/?(?:a|abbr|b|cite|code|del|em|i|img|ins|kbd|mark|q|ruby|s|samp|small|span|strong|sub|sup|time|u|var)\b[^>]*>/gi, '')
    .replace(/<\/[a-z][^>]*>|<[a-z][\w:-]*\s*\/?>|<[a-z][\w:-]*\s+[^>]*=[^>]*>/gi, '')
    .replace(/\0AUTOLINK_(\d+)\0/g, (_match, index) => autolinks[Number(index)])
    .replace(/^\s*```[^\n]*$/gm, '')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)]\(((?:https?:\/\/|mailto:)[^\s)]+)(?:\s+["'][^"']*["'])?\)/g, '$1 ($2)')
    .replace(/\[([^\]]+)]\[[^\]]*]/g, '$1')
    .replace(/^\s*\[([^\]]+)]:\s*(\S+).*$/gm, '$1: $2')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/^\s*(?:=+|-+)\s*$/gm, '')
    .replace(/^\s*\|?(?:\s*:?-{3,}:?\s*\|)+\s*$/gm, '')
    .replace(/^(\s*)[-+*]\s+\[x]\s+/gim, '$1☑ ')
    .replace(/^(\s*)[-+*]\s+\[\s]\s+/gm, '$1☐ ')
    .replace(/^(\s*)[-+*]\s+/gm, '$1• ')
    .replace(/^\s*>\s?/gm, '')
    .replace(/~~([^~]+)~~/g, '$1')
    .replace(/\*\*([^*]+)\*\*|__([^_]+)__/g, '$1$2')
    .replace(/(?<!\w)[*_]([^*_\n]+)[*_](?!\w)/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\\([\\`*{}\[\]()#+\-.!_>])/g, '$1');

  text = decodeHtmlEntities(text)
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trimEnd())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return truncateText(text || DEFAULT_RELEASE_NOTES, maxLength);
};

module.exports = { formatReleaseNotes };

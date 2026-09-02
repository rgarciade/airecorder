import { describe, expect, it } from 'vitest';
import releaseNotes from '../../../../electron/utils/releaseNotes.js';

const { formatReleaseNotes } = releaseNotes;

describe('formatReleaseNotes', () => {
  it('preserves headings and lists while removing Markdown syntax', () => {
    const markdown = `## Highlights

- **Faster** transcription
- [Fixed issue](https://github.com/rgarciade/airecorder/issues/95)
1. Install the update`;

    expect(formatReleaseNotes(markdown)).toBe(`Highlights

• Faster transcription
• Fixed issue (https://github.com/rgarciade/airecorder/issues/95)
1. Install the update`);
  });

  it('converts checklists, code, quotes, HTML and entities to readable text', () => {
    const markdown = `> Use \`npm run build\`<br>
- [x] Ready &amp; tested
- [ ] Publish
<!-- internal note -->`;

    expect(formatReleaseNotes(markdown)).toBe(`Use npm run build

☑ Ready & tested
☐ Publish`);
  });

  it('preserves invalid numeric entities without throwing', () => {
    const markdown = 'Invalid: &#99999999; &#x110000; &#xD800;';

    expect(() => formatReleaseNotes(markdown)).not.toThrow();
    expect(formatReleaseNotes(markdown)).toBe(markdown);
  });

  it('preserves Markdown autolinks and legitimate angle-bracket text', () => {
    const markdown = 'Links: <https://example.com> <mailto:hello@example.com> <keep this>';

    expect(formatReleaseNotes(markdown)).toBe(
      'Links: https://example.com mailto:hello@example.com <keep this>'
    );
  });

  it('converts arbitrary HTML blocks to readable separators and removes tags', () => {
    const markdown = '<section><p>one <mark>new</mark></p><p>two</p><widget data-id="1">three</widget></section>';

    expect(formatReleaseNotes(markdown)).toBe('one new\n\ntwo\nthree');
  });

  it('converts inline Markdown mailto links to readable text', () => {
    expect(formatReleaseNotes('[mail](mailto:test@example.com)')).toBe(
      'mail (mailto:test@example.com)'
    );
  });

  it('normalizes line endings, repeated spaces and excessive blank lines', () => {
    expect(formatReleaseNotes('Title\r\n\r\n\r\nText   with   spaces')).toBe(
      'Title\n\nText with spaces'
    );
  });

  it('uses a plain-text fallback for empty release notes', () => {
    expect(formatReleaseNotes('   ')).toBe('Mejoras y correcciones.');
  });

  it('applies the length limit to fallback release notes', () => {
    const result = formatReleaseNotes('   ', 8);

    expect(result).toBe('Mejoras…');
    expect(result.length).toBeLessThanOrEqual(8);
  });

  it('truncates at a readable boundary without exceeding the limit', () => {
    const result = formatReleaseNotes(`Important changes. ${'word '.repeat(30)}`, 60);

    expect(result.length).toBeLessThanOrEqual(60);
    expect(result).toMatch(/word…$/);
    expect(result).not.toMatch(/\bwor…$/);
  });

  it('does not split surrogate pairs when truncating', () => {
    const result = formatReleaseNotes('123😀456', 5);

    expect(result).toBe('123…');
    expect(result.length).toBeLessThanOrEqual(5);
  });
});

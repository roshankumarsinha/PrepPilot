import { classifyLink, extractLinks, stripUrls } from '../links';

describe('extractLinks', () => {
  it('finds HTML, markdown and bare links once each, keeping the label', () => {
    const raw = [
      '<a href="https://chatgpt.com/share/abc">ChatGPT <b>Notes</b></a>',
      '[Video](https://www.youtube.com/watch?v=xyz)',
      'See https://chatgpt.com/share/abc and https://web.dev/learn.',
    ].join('\n');
    expect(extractLinks(raw)).toEqual([
      { url: 'https://chatgpt.com/share/abc', kind: 'chatgpt', label: 'ChatGPT Notes' },
      { url: 'https://www.youtube.com/watch?v=xyz', kind: 'youtube', label: 'Video' },
      { url: 'https://web.dev/learn', kind: 'article', label: null },
    ]);
  });

  it('ignores localhost and example hosts used in code samples', () => {
    expect(
      extractLinks('fetch("http://localhost:3000/api"); https://api.example.com/users'),
    ).toEqual([]);
  });
});

describe('classifyLink', () => {
  it.each([
    ['https://youtu.be/abc', 'youtube'],
    ['https://chat.openai.com/share/abc', 'chatgpt'],
    ['https://chatgpt.com/c/abc', 'article'],
    ['https://example.org/diagram.png', 'other'],
  ])('%s is %s', (url, kind) => {
    expect(classifyLink(url)).toBe(kind);
  });
});

describe('stripUrls', () => {
  it('keeps link labels and drops raw URLs', () => {
    expect(stripUrls('Read [the docs](https://a.dev) or https://b.dev now')).toBe(
      'Read the docs or  now',
    );
  });
});

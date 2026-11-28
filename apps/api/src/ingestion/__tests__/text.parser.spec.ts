import { chunkDocument } from '../chunker';
import { parseText } from '../text.parser';

const NOTES = `================================================================================
IMPORTANT NODE.JS INTERVIEW QUESTIONS
================================================================================

1. What is Node.js? Explain with a real-world analogy.
--------------------------------------------------------------------------------

Node.js is a JavaScript runtime environment built on Chrome's V8 engine. ${'It runs JS outside the browser. '.repeat(10)}

Real-World Analogy:
-------------------
Think of JavaScript as a chef's skillset. ${'The food truck goes anywhere. '.repeat(10)}

2. What is the event loop?
--------------------------
The event loop lets Node.js perform non-blocking I/O. ${'It polls queues. '.repeat(20)}
`;

describe('parseText', () => {
  it('reads underlined headings into a hierarchy', () => {
    const doc = parseText(NOTES, 'Imp Question On Nodejs');
    expect(doc.sections.map((s) => s.headingPath)).toEqual([
      ['IMPORTANT NODE.JS INTERVIEW QUESTIONS'],
      [
        'IMPORTANT NODE.JS INTERVIEW QUESTIONS',
        '1. What is Node.js? Explain with a real-world analogy.',
      ],
      [
        'IMPORTANT NODE.JS INTERVIEW QUESTIONS',
        '1. What is Node.js? Explain with a real-world analogy.',
        'Real-World Analogy',
      ],
      ['IMPORTANT NODE.JS INTERVIEW QUESTIONS', '2. What is the event loop?'],
    ]);
  });

  it('drops the ==== and ---- layout lines from chunk content', () => {
    const chunks = chunkDocument(parseText(NOTES, 'Imp Question On Nodejs'));
    expect(chunks.length).toBeGreaterThan(0);
    for (const chunk of chunks) expect(chunk.content).not.toMatch(/^[=-]{3,}$/m);
    expect(chunks[0]?.headingPath[0]).toBe('Imp Question On Nodejs');
  });
});

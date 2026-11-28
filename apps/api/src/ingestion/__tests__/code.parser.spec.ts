import { CODE_MAX_CHARS, humanizeFileName } from '../code.parser';
import { problemKey, processDocument } from '../parse-document';

describe('humanizeFileName', () => {
  it.each([
    ['12_merge2BST', 'Merge 2 BST'],
    ['4_fewQuesOnPrefixSum', 'Few Ques On Prefix Sum'],
    ['11_maximumAreaOfRectangle(histogram)', 'Maximum Area Of Rectangle (histogram)'],
    ['sumOfDigits', 'Sum Of Digits'],
  ])('%s -> %s', (input, expected) => {
    expect(humanizeFileName(input)).toBe(expected);
  });
});

describe('problemKey', () => {
  it('uses the folder and problem number so renamed twins still match', () => {
    expect(problemKey('Linked-List/15_2Ques-YIntersection&RotateLLbyK.cpp')).toBe('Linked-List/15');
    expect(problemKey('Linked-List/15_2ImpQues.js')).toBe('Linked-List/15');
  });

  it('falls back to the file name when there is no number', () => {
    expect(problemKey('prime.cpp')).toBe('prime');
  });
});

describe('processDocument for code', () => {
  const codePairs = ['General-DSA-Questions', 'JS-DSA-Questions'];
  const solution =
    '// Merge two BSTs.\n\n// Approach 1: inorder arrays\n\nint merge() {\n  return 0;\n}\n';

  it('titles the chunk after the problem and language, and links the C++/JS twins', () => {
    const cpp = processDocument({
      repoName: 'DSA',
      path: 'General-DSA-Questions/Binary Search Tree/12_merge2BST.cpp',
      content: solution,
      codePairs,
    });
    const js = processDocument({
      repoName: 'DSA',
      path: 'JS-DSA-Questions/Binary Search Tree/12_merge2BST.js',
      content: solution,
      codePairs,
    });

    expect(cpp?.chunks[0]?.headingPath).toEqual(['Binary Search Tree', 'Merge 2 BST (C++)']);
    expect(js?.chunks[0]?.headingPath).toEqual(['Binary Search Tree', 'Merge 2 BST (JavaScript)']);
    expect(cpp?.chunks[0]?.content.startsWith('```cpp\n')).toBe(true);
    expect(cpp?.problemKey).toBe('Binary Search Tree/12');
    expect(js?.problemKey).toBe(cpp?.problemKey);
  });

  it('splits a long file at top-level blocks, each within the size cap', () => {
    const fn = (i: number) => `// Approach ${i}\nint solve${i}() {\n${'  x++;\n'.repeat(250)}}\n`;
    const content = [1, 2, 3].map(fn).join('\n');
    const doc = processDocument({
      repoName: 'DSA',
      path: 'Arrays/1_long.cpp',
      content,
      codePairs: [],
    });

    expect(doc?.chunks.length).toBeGreaterThan(1);
    for (const chunk of doc?.chunks ?? [])
      expect(chunk.content.length).toBeLessThanOrEqual(CODE_MAX_CHARS);
    expect(doc?.chunks[1]?.content).toContain('// Approach 2');
  });
});

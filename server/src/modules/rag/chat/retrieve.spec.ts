import { readSse } from './retrieve.js';

describe('readSse', () => {
  it('joins text pieces and recognizes the terminal marker', () => {
    const first = readSse('data: {"text":"你"}\n\ndata: {"te');
    const second = readSse(`${first.rest}xt":"好"}\n\ndata: [DONE]\n\n`);

    expect(first.pieces).toEqual([{ kind: 'text', text: '你' }]);
    expect(second.pieces).toEqual([
      { kind: 'text', text: '好' },
      { kind: 'done' },
    ]);
    expect(
      [...first.pieces, ...second.pieces]
        .filter((piece) => piece.kind === 'text')
        .map((piece) => piece.text)
        .join(''),
    ).toBe('你好');
  });

  it('reads an error event and leaves an unfinished block buffered', () => {
    const parsed = readSse('data: {"error":"模型不可用"}\n\ndata: {"text":');

    expect(parsed.pieces).toEqual([{ kind: 'error', message: '模型不可用' }]);
    expect(parsed.rest).toBe('data: {"text":');
  });

  it('reads citation events and skips incomplete items', () => {
    const parsed = readSse(
      'data: {"citations":[{"documentId":"d1","chunkIndex":0,"content":"原文"},{"content":"缺文档"}]}\n\n',
    );

    expect(parsed.pieces).toEqual([
      {
        kind: 'citations',
        citations: [{ documentId: 'd1', chunkIndex: 0, content: '原文' }],
      },
    ]);
  });
});

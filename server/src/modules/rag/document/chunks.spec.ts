import { ChunkMethod } from '@prisma/client';
import { assertChunks, assertFileType } from './chunks.js';

const base = {
  chunkMethod: ChunkMethod.CHAR,
  chunkSeparator: '\\n',
  chunkSize: 100,
};

describe('assertChunks', () => {
  it('accepts chunks separated only by the configured separator', () => {
    expect(() =>
      assertChunks('你好\n\n世界', { ...base, chunks: ['你好', '世界'] }),
    ).not.toThrow();
  });

  it('rejects chunks that are not a cover of the document', () => {
    expect(() =>
      assertChunks('你好世界', { ...base, chunks: ['你好', '别处'] }),
    ).toThrow('分片与文档内容不一致');
  });

  it('rejects a fixed chunk longer than the limit', () => {
    expect(() =>
      assertChunks('你好世界', {
        chunkMethod: ChunkMethod.FIXED,
        chunkSeparator: '',
        chunkSize: 100,
        chunks: ['你好世界'.padEnd(101, '啊')],
      }),
    ).toThrow('存在超过最大字符数的分片');
  });

  it('rejects a separator-only chunk', () => {
    expect(() =>
      assertChunks('你好\n世界', { ...base, chunks: ['你好', '\n', '世界'] }),
    ).toThrow('存在仅含切分字符或空格的分片');
  });
});

describe('assertFileType', () => {
  it('rejects an unsupported extension', () => {
    expect(() => assertFileType('exe')).toThrow('仅支持');
  });
});

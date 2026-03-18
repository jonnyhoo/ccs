import * as fs from 'fs';

const DEFAULT_TAIL_CHUNK_BYTES = 64 * 1024;

export function readFileTailLines(filePath: string, maxLines: number): string[] {
  if (maxLines <= 0 || !fs.existsSync(filePath)) return [];

  let fd: number | null = null;

  try {
    fd = fs.openSync(filePath, 'r');
    const { size } = fs.fstatSync(fd);
    if (size === 0) return [];

    let position = size;
    let newlineCount = 0;
    const chunks: Buffer[] = [];

    while (position > 0 && newlineCount <= maxLines) {
      const readSize = Math.min(DEFAULT_TAIL_CHUNK_BYTES, position);
      position -= readSize;

      const chunk = Buffer.alloc(readSize);
      fs.readSync(fd, chunk, 0, readSize, position);
      chunks.unshift(chunk);

      for (let i = 0; i < chunk.length; i++) {
        if (chunk[i] === 0x0a) newlineCount++;
      }
    }

    return Buffer.concat(chunks)
      .toString('utf8')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .slice(-maxLines);
  } catch {
    return [];
  } finally {
    if (fd !== null) fs.closeSync(fd);
  }
}

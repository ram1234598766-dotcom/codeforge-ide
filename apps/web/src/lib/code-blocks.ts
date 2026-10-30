export function extractCodeBlocks(response: string): string[] {
  const blocks: string[] = [];
  const pattern = /```[^\n`]*\n([\s\S]*?)```/g;
  for (const match of response.matchAll(pattern)) {
    const code = match[1].replace(/^\n+|\n+$/g, '');
    if (code.trim()) blocks.push(code);
  }
  return blocks;
}

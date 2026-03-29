import { docs } from '@/.source';
import { loader } from 'fumadocs-core/source';

const mdxSource = docs.toFumadocsSource();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const files = (mdxSource.files as any);

export const source = loader({
  baseUrl: '/docs',
  source: {
    files: typeof files === 'function' ? files() : files,
  },
});

import type { ImageMetadata } from 'astro';
import { getCanonical } from '~/utils/permalinks';
import type { Post } from '~/types';

export { serializeStructuredData } from './serializeStructuredData';

export const personId = String(getCanonical('/#person'));
export const websiteId = String(getCanonical('/#website'));

export const contentStructuredData = (post: Post, url: string, kind: 'BlogPosting' | 'CreativeWork') => {
  const image = typeof post.image === 'string' ? post.image : (post.image as ImageMetadata | undefined)?.src;
  return {
    '@context': 'https://schema.org',
    '@type': kind,
    '@id': `${url}#${kind === 'BlogPosting' ? 'article' : 'project'}`,
    ...(kind === 'BlogPosting' ? { headline: post.title } : { name: post.title }),
    description: post.excerpt,
    url,
    mainEntityOfPage: { '@id': `${url}#webpage` },
    author: { '@id': personId },
    ...(kind === 'BlogPosting' ? { publisher: { '@id': personId } } : { creator: { '@id': personId } }),
    datePublished: post.publishDate.toISOString(),
    ...(post.updateDate ? { dateModified: post.updateDate.toISOString() } : {}),
    ...(image ? { image: String(new URL(image, String(getCanonical('/')))) } : {}),
    ...(post.repoUrl ? { codeRepository: post.repoUrl, '@type': 'SoftwareSourceCode' } : {}),
    ...(post.technologies ? { keywords: post.technologies.join(', ') } : {}),
    isPartOf: { '@id': websiteId },
    inLanguage: 'en',
  };
};

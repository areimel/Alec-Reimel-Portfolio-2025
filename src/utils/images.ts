import type { ImageMetadata } from 'astro';
import responsiveImages from '~/generated/responsive-images.json';
import type { OpenGraph } from '@astrolib/seo';

const load = async function () {
  let images: Record<string, () => Promise<unknown>> | undefined = undefined;
  try {
    images = import.meta.glob('~/assets/images/**/*.{jpeg,jpg,png,tiff,webp,gif,svg,JPEG,JPG,PNG,TIFF,WEBP,GIF,SVG}');
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (error) {
    // continue regardless of error
  }
  return images;
};

let _images: Record<string, () => Promise<unknown>> | undefined = undefined;

/** */
export const fetchLocalImages = async () => {
  _images = _images || (await load());
  return _images;
};

/** */
export const findImage = async (
  imagePath?: string | ImageMetadata | null
): Promise<string | ImageMetadata | undefined | null> => {
  // Not string
  if (typeof imagePath !== 'string') {
    return imagePath;
  }

  // Absolute paths
  if (imagePath.startsWith('http://') || imagePath.startsWith('https://') || imagePath.startsWith('/')) {
    return imagePath;
  }

  // Relative paths or not "~/assets/"
  if (!imagePath.startsWith('~/assets/images')) {
    return imagePath;
  }

  const images = await fetchLocalImages();
  const key = imagePath.replace('~/', '/src/');

  return images && typeof images[key] === 'function'
    ? ((await images[key]()) as { default: ImageMetadata })['default']
    : null;
};

/** */
export const adaptOpenGraphImages = async (
  openGraph: OpenGraph = {},
  astroSite: URL | undefined = new URL('')
): Promise<OpenGraph> => {
  if (!openGraph?.images?.length) {
    return openGraph;
  }

  const images = openGraph.images;

  // Resolve local responsive previews while preserving caller metadata.
  const adaptedImages = await Promise.all(
    images.map(async (image) => {
      if (image?.url) {
        const resolvedImage = (await findImage(image.url)) as ImageMetadata | string | undefined;
        if (!resolvedImage) {
          return {
            url: '',
          };
        }

        // Prefer a bounded local preview with known dimensions for social sharing.
        const sourceUrl = typeof resolvedImage === 'string' ? resolvedImage : resolvedImage?.src || '';
        const variants = (responsiveImages as Record<string, { src: string; width: number; height: number }[]>)[
          sourceUrl
        ];
        const preview = variants?.at(-1);
        const imageUrl = preview?.src || sourceUrl;

        return {
          url: imageUrl.startsWith('/') ? String(new URL(imageUrl, astroSite)) : imageUrl,
          width:
            preview?.width ?? image.width ?? (typeof resolvedImage !== 'string' ? resolvedImage?.width : undefined),
          height:
            preview?.height ?? image.height ?? (typeof resolvedImage !== 'string' ? resolvedImage?.height : undefined),
          alt: image.alt,
        };
      }

      return {
        url: '',
      };
    })
  );

  return { ...openGraph, ...(adaptedImages ? { images: adaptedImages } : {}) };
};

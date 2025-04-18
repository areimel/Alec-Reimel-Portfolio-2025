import type { PaginateFunction } from 'astro';
import { getCollection, render } from 'astro:content';
import type { CollectionEntry } from 'astro:content';
import type { Post } from '~/types';
import { cleanSlug, trimSlash, PROJECTS_BASE, PROJECT_PERMALINK_PATTERN, PROJECT_CATEGORY_BASE, PROJECT_TAG_BASE } from './permalinks';

// Using project-specific constants from permalinks.ts
const generatePermalink = async ({
  id,
  slug,
  publishDate,
  category,
}: {
  id: string;
  slug: string;
  publishDate: Date;
  category: string | undefined;
}) => {
  const year = String(publishDate.getFullYear()).padStart(4, '0');
  const month = String(publishDate.getMonth() + 1).padStart(2, '0');
  const day = String(publishDate.getDate()).padStart(2, '0');
  const hour = String(publishDate.getHours()).padStart(2, '0');
  const minute = String(publishDate.getMinutes()).padStart(2, '0');
  const second = String(publishDate.getSeconds()).padStart(2, '0');

  const permalink = PROJECT_PERMALINK_PATTERN.replace('%slug%', slug)
    .replace('%id%', id)
    .replace('%category%', category || '')
    .replace('%year%', year)
    .replace('%month%', month)
    .replace('%day%', day)
    .replace('%hour%', hour)
    .replace('%minute%', minute)
    .replace('%second%', second);

  return permalink
    .split('/')
    .map((el) => trimSlash(el))
    .filter((el) => !!el)
    .join('/');
};

// Using Project type as Post for now (they have the same shape in our base implementation)
// Could be expanded later with project-specific fields
const getNormalizedProject = async (project: CollectionEntry<'project'>): Promise<Post> => {
  const { id, data } = project;
  const { Content, remarkPluginFrontmatter } = await render(project);

  const {
    publishDate: rawPublishDate = new Date(),
    updateDate: rawUpdateDate,
    title,
    excerpt,
    image,
    tags: rawTags = [],
    category: rawCategory,
    author,
    draft = false,
    metadata = {},
    projectUrl, // Project specific fields
    repoUrl,
    technologies,
    client,
    duration,
    role,
  } = data;

  const slug = cleanSlug(id);
  const publishDate = new Date(rawPublishDate);
  const updateDate = rawUpdateDate ? new Date(rawUpdateDate) : undefined;

  const category = rawCategory
    ? {
        slug: cleanSlug(rawCategory),
        title: rawCategory,
      }
    : undefined;

  const tags = rawTags.map((tag: string) => ({
    slug: cleanSlug(tag),
    title: tag,
  }));

  return {
    id: id,
    slug: slug,
    permalink: await generatePermalink({ id, slug, publishDate, category: category?.slug }),

    publishDate: publishDate,
    updateDate: updateDate,

    title: title,
    excerpt: excerpt,
    image: image,

    category: category,
    tags: tags,
    author: author,

    draft: draft,

    metadata,

    Content: Content,

    readingTime: remarkPluginFrontmatter?.readingTime,
    
    // Add project specific fields to the returned object
    projectUrl,
    repoUrl,
    technologies,
    client,
    duration,
    role,
  };
};

const load = async function (): Promise<Array<Post>> {
  const projects = await getCollection('project');
  const normalizedProjects = projects.map(async (project) => await getNormalizedProject(project));

  const results = (await Promise.all(normalizedProjects))
    .sort((a, b) => b.publishDate.valueOf() - a.publishDate.valueOf())
    .filter((project) => !project.draft);

  return results;
};

let _projects: Array<Post>;

// Config values - can be expanded later with specific project settings
export const isProjectsEnabled = true;
export const isRelatedProjectsEnabled = false;
export const isProjectsListRouteEnabled = true;
export const isProjectPostRouteEnabled = true;
export const isProjectCategoryRouteEnabled = true;
export const isProjectTagRouteEnabled = true;

export const projectsListRobots = { index: true, follow: true };
export const projectPostRobots = { index: true, follow: true };
export const projectCategoryRobots = { index: true, follow: true };
export const projectTagRobots = { index: false, follow: true };

export const projectsPerPage = 12; // More projects per page than blog posts

/** */
export const fetchProjects = async (): Promise<Array<Post>> => {
  if (!_projects) {
    _projects = await load();
  }

  return _projects;
};

/** */
export const findProjectsBySlugs = async (slugs: Array<string>): Promise<Array<Post>> => {
  if (!Array.isArray(slugs)) return [];

  const projects = await fetchProjects();

  return slugs.reduce(function (r: Array<Post>, slug: string) {
    projects.some(function (project: Post) {
      return slug === project.slug && r.push(project);
    });
    return r;
  }, []);
};

/** */
export const findProjectsByIds = async (ids: Array<string>): Promise<Array<Post>> => {
  if (!Array.isArray(ids)) return [];

  const projects = await fetchProjects();

  return ids.reduce(function (r: Array<Post>, id: string) {
    projects.some(function (project: Post) {
      return id === project.id && r.push(project);
    });
    return r;
  }, []);
};

/** */
export const findLatestProjects = async ({ count }: { count?: number }): Promise<Array<Post>> => {
  const _count = count || 4;
  const projects = await fetchProjects();

  return projects ? projects.slice(0, _count) : [];
};

/** */
export const getStaticPathsProjectsList = async ({ paginate }: { paginate: PaginateFunction }) => {
  if (!isProjectsEnabled || !isProjectsListRouteEnabled) return [];
  return paginate(await fetchProjects(), {
    params: { projects: PROJECTS_BASE || undefined },
    pageSize: projectsPerPage,
  });
};

/** */
export const getStaticPathsProjectPost = async () => {
  if (!isProjectsEnabled || !isProjectPostRouteEnabled) return [];
  return (await fetchProjects()).flatMap((project) => ({
    params: {
      projects: project.permalink,
    },
    props: { project },
  }));
};

/** */
export const getStaticPathsProjectCategory = async ({ paginate }: { paginate: PaginateFunction }) => {
  if (!isProjectsEnabled || !isProjectCategoryRouteEnabled) return [];

  const projects = await fetchProjects();
  const categories = {};
  projects.map((project) => {
    if (project.category?.slug) {
      categories[project.category?.slug] = project.category;
    }
  });

  return Array.from(Object.keys(categories)).flatMap((categorySlug) =>
    paginate(
      projects.filter((project) => project.category?.slug && categorySlug === project.category?.slug),
      {
        params: { category: categorySlug, projects: PROJECT_CATEGORY_BASE || undefined },
        pageSize: projectsPerPage,
        props: { category: categories[categorySlug] },
      }
    )
  );
};

/** */
export const getStaticPathsProjectTag = async ({ paginate }: { paginate: PaginateFunction }) => {
  if (!isProjectsEnabled || !isProjectTagRouteEnabled) return [];

  const projects = await fetchProjects();
  const tags = {};
  projects.map((project) => {
    if (Array.isArray(project.tags)) {
      project.tags.map((tag) => {
        tags[tag?.slug] = tag;
      });
    }
  });

  return Array.from(Object.keys(tags)).flatMap((tagSlug) =>
    paginate(
      projects.filter((project) => Array.isArray(project.tags) && project.tags.find((elem) => elem.slug === tagSlug)),
      {
        params: { tag: tagSlug, projects: PROJECT_TAG_BASE || undefined },
        pageSize: projectsPerPage,
        props: { tag: tags[tagSlug] },
      }
    )
  );
}; 
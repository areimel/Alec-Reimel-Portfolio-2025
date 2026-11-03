import type { APIRoute } from 'astro';
import { getCanonical } from '~/utils/permalinks';
import { fetchProjects } from '~/utils/projects';
import { profile } from '~/data/profile';

export const prerender = true;

export const GET: APIRoute = async () => {
  const projects = await fetchProjects();
  const link = (path: string) => String(getCanonical(path));
  const text = [
    '# Alec Reimel — Software Developer',
    '',
    '> Alec Reimel is a software developer with 10+ years of professional experience in full-stack development, applied AI, and marketing technology. Interested in US remote software roles.',
    '',
    '## Profile and hiring',
    '',
    `- [Home](${link('/')}): Introduction and selected work.`,
    `- [About](${link('/about')}): Background, engineering interests, and working approach.`,
    `- [Experience](${link('/resume')}): Professional experience, education, technical skills, and selected projects.`,
    `- [Contact](${link('/contact')}): Hiring inquiries and direct email.`,
    `- [Résumé PDF](${link(profile.resumePdf)}): Full 2026 résumé supplied by Alec.`,
    `- [LinkedIn](${profile.linkedin}): Professional profile.`,
    `- [GitHub](${profile.github}): Public source repositories.`,
    '',
    '## Projects',
    '',
    `- [All projects](${link('/projects')}): Project collection and implementation notes.`,
    ...projects.map(
      (project) =>
        `- [${project.title}](${link(`/${project.permalink}`)}): ${project.excerpt || 'Project details and source code.'}`
    ),
    '',
    '## Writing',
    '',
    `- [Engineering notes](${link('/blog')}): Articles about development tools and creative technology.`,
    '',
    'Professional experience and education are summarized from Alec’s supplied résumé. Project pages distinguish implemented capabilities from planned work and link to public source code.',
    '',
  ].join('\n');
  return new Response(text, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};

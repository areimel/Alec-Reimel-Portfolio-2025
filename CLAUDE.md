# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Core Development
- **Start development server**: `pnpm run dev` (runs on http://localhost:4321)
- **Build for production**: `pnpm run build`
- **Preview build**: `pnpm run preview`
- **Development with external host**: `pnpm run dev-host`

### Code Quality
- **Run all checks**: `pnpm run check` (combines Astro, ESLint, and Prettier checks)
- **Check Astro files**: `pnpm run check:astro`
- **Check ESLint**: `pnpm run check:eslint`
- **Check Prettier formatting**: `pnpm run check:prettier`
- **Fix all issues**: `pnpm run fix` (combines ESLint and Prettier fixes)
- **Fix ESLint issues**: `pnpm run fix:eslint`
- **Fix Prettier formatting**: `pnpm run fix:prettier`

## Project Architecture

This is an Astro 5.x-based developer portfolio with a retro terminal theme. The project is built on the AstroWind template but heavily customized for a unique "80s lo-fi computer terminal" aesthetic.

### Key Technologies
- **Framework**: Astro 5.x with static site generation
- **Styling**: Tailwind CSS with custom terminal theme variables
- **Content**: MDX for blog posts and projects
- **Deployment**: Netlify (configured via netlify.toml)
- **Package Manager**: pnpm

### Directory Structure
```
src/
├── assets/           # Static assets (images, fonts, styles)
├── components/       # Reusable Astro components
│   ├── AnimationComponents/    # Terminal animations and effects
│   ├── ContentComponents/      # Homepage content sections
│   ├── TerminalComponents/     # Terminal UI elements
│   ├── ProjectComponents/      # Project showcase components
│   ├── blog/                  # Blog-specific components
│   ├── common/                # Shared utilities
│   └── widgets/               # Layout widgets
├── content/          # Blog posts and project content (MDX)
├── data/            # Static data files
├── layouts/         # Page layouts
├── pages/           # File-based routing
├── styles/          # Global styles
└── utils/           # Utility functions
```

### Theme System
The project uses a multi-theme system allowing the user to switch between multiple color palettes.
- Custom fonts: Terminal/retro fonts including VT323, Share Tech Mono, Windows Command Prompt font

### Content Management
- **Blog**: Located in `src/data/post/` as Markdown files
- **Projects**: Located in `src/data/projects/` as MDX files
- **Configuration**: Site settings in `src/config.yaml`
- **Navigation**: Defined in `src/navigation.ts`

### Important Patterns
1. **Component Structure**: Always use the Astro component script section (---) at the top
2. **Path Aliases**: Use `@` aliases defined in tsconfig.json (`@components/`, `@layouts/`, etc.)
3. **Styling**: Leverage custom terminal theme classes from tailwind.config.js
4. **Image Handling**: Uses passthrough image service (configured in astro.config.ts)

### Custom Features
- Terminal-style loading screens and animations
- Retro CRT effects and glitch animations
- Dynamic theme switching between green and amber terminal themes
- Custom terminal fonts and typography
- Animation control system for performance optimization

### Development Notes
- The project disables Tailwind's base styles (`applyBaseStyles: false`)
- Custom CSS variables are defined for the terminal theme system
- Uses Astro's partial hydration with framework-agnostic components
- Static site generation optimized for performance
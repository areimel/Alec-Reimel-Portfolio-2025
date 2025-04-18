# Alec Reimel - Developer Portfolio

This project is a rebuild of my developer portfolio website, designed to showcase coding skills and artistic vision through a unique "80s lo-fi computer terminal" aesthetic.

## Project Vision

The core design revolves around simulating the look and feel of vintage computer monitors, blending elements of retro-futurism, cyberpunk, and cassette futurism with neo-brutalist design principles. Key visual features include:

*   **Dual Color Schemes:** A theme system toggling between classic green phosphor (dark mode) and amber CRT (light mode) aesthetics.
*   **Retro-Futurist UI:** Interface components inspired by old-school terminals.
*   **Glitch Effects & Filters:** Intentional visual artifacts and overlays to enhance the lo-fi feel.
*   **Animations:** Loading screens, page transitions, cursor effects, and text animations contribute to the dynamic terminal experience. An animation control panel allows users to toggle effects.

## Tech Stack

*   **Framework:** [Astro](https://astro.build/) (v5.x)
*   **Base Template:** [Astrowind](https://github.com/onwidget/astrowind) (heavily customized)
*   **Styling:** [Tailwind CSS](https://tailwindcss.com/) with custom theme configuration
*   **Deployment:** [Netlify](https://www.netlify.com/)
*   **Package Manager:** [pnpm](https://pnpm.io/)

## Key Features

*   **Green/Amber Theme Switcher:** Toggles between the two primary color schemes.
*   **Advanced Animation System:** Includes loading screens, page transitions, cursor effects, and text animations.
*   **Animation Control Panel:** Allows users to enable/disable certain animations for performance or preference.
*   **Portfolio Showcase:** Sections detailing current projects (AI, VR/AR, Analytics, Templates) and past client work.
*   **Blog System:** Features posts categorized as "Project Updates," "Coding Crash Courses," and "Tips & Tricks," with distinct templates.

## Project Structure

```
/
├── public/
├── src/
│   ├── assets/         # Styles, images, fonts
│   ├── components/     # Reusable UI components (Astro, React, etc.)
│   ├── content/        # Blog posts and site content (Markdown, MDX)
│   ├── layouts/        # Base page layouts
│   ├── pages/          # Site routes
│   ├── utils/          # Utility functions
│   ├── config.yaml     # Site-wide configuration
│   └── navigation.js   # Site navigation structure
├── astro.config.mjs    # Astro configuration
├── tailwind.config.cjs # Tailwind CSS configuration
├── tsconfig.json       # TypeScript configuration
└── package.json
```

## Getting Started

### Prerequisites

*   Node.js (LTS version recommended)
*   pnpm (or npm/yarn)

### Installation

Clone the repository and install dependencies:

```bash
git clone <repository-url>
cd <repository-directory>
pnpm install
```

### Development

Start the local development server:

```bash
pnpm run dev
```

This will typically start the server at `http://localhost:4321`.

### Build

Create a production-ready build:

```bash
pnpm run build
```

The output will be generated in the `dist/` directory.

## Configuration

*   **Site Metadata & Features:** Modify `./src/config.yaml` for site name, metadata, blog settings, etc.
*   **Styling & Theme:**
    *   Customize base styles in `src/assets/styles/tailwind.css`.
    *   Adjust Tailwind theme settings (colors, fonts) in `tailwind.config.cjs`.
    *   Specific theme component styles might be found in `src/components/CustomStyles.astro` or similar.
*   **Navigation:** Edit `./src/navigation.js` to change header/footer links.

## Deployment

This project is configured for deployment on Netlify. Continuous deployment is typically set up to trigger from pushes to the `main` branch.

## License

This project utilizes code from the Astrowind template, which is licensed under the MIT license. See the [LICENSE](./LICENSE.md) file for details.

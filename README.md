# 🌍 Hitchmap

[![License](https://img.shields.io/badge/License-Unlicense-blue.svg)](https://unlicense.org/)

A web application that allows users to view and share hitchhiking experiences on an interactive global map, creating a community-driven platform for hitchhikers to rate and comment on pickup locations and rides. It uses the Nostr protocol for decentralized data storage.

Hitchmap nostr is an effort to put hitchhiking spots and related information on nostr and allowing users to link their existing identities (e.g. [trustroots nip5](https://ideas.trustroots.org/2024/08/14/nostr-updates/)).

Spots, rides and recent changes on hitchwiki are fetched by the [nostrhitch bot](https://github.com/Hitchwiki/nostrhitch) and converted into nostr notes.

## Features

- Interactive globe map with clustered hitchhiking spots
- Color-coded ratings (red/orange/green for poor/average/good experiences)
- Add new hitchhiking experiences with ratings and comments
- Real-time data loading from Nostr network
- Location-based experience sharing
- Community-driven content

## Tech Stack

- **Frontend**: SvelteKit, Svelte 5
- **Mapping**: MapLibre GL JS
- **Data**: Nostr protocol (@nostr-dev-kit)
- **Styling**: Tailwind CSS
- **Testing**: Vitest (unit), Playwright (e2e)
- **Development**: Vite, Storybook, ESLint, Prettier
- **Package Manager**: pnpm

## Installation

1. Ensure you have [Node.js](https://nodejs.org/) installed.
2. Install [pnpm](https://pnpm.io/) if you haven't already:
   ```sh
   npm install -g pnpm
   ```
3. Clone the repository:
   ```sh
   git clone https://github.com/Hitchwiki/hitchmap-nostr.git
   cd frontend
   ```
4. Install dependencies:
   ```sh
   pnpm install
   ```
5. Start the development server:
   ```sh
   pnpm dev
   ```
   The application will be available at `http://localhost:5173`.

## Development

### Available Scripts

- `pnpm dev` - Start the development server
- `pnpm build` - Build the application for production
- `pnpm preview` - Preview the production build locally
- `pnpm check` - Run type checking with Svelte and TypeScript
- `pnpm check:watch` - Run type checking in watch mode
- `pnpm format` - Format code with Prettier
- `pnpm lint` - Check code formatting and linting
- `pnpm test:unit` - Run unit tests with Vitest
- `pnpm test` - Run all tests (unit and e2e)
- `pnpm test:e2e` - Run end-to-end tests with Playwright
- `pnpm storybook` - Start Storybook development server
- `pnpm build-storybook` - Build Storybook for deployment

### Project Structure

- `src/lib/` - Shared utilities, components, and processors
- `src/routes/` - SvelteKit routes and pages
- `src/stories/` - Storybook stories for components
- `e2e/` - End-to-end tests
- `static/` - Static assets

## Contributing

We welcome contributions to Hitchmap! Here's how you can help:

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature-name`
3. Make your changes and ensure tests pass: `pnpm test`
4. Format your code: `pnpm format`
5. Commit your changes: `git commit -m 'Add some feature'`
6. Push to the branch: `git push origin feature/your-feature-name`
7. Open a pull request

Please ensure your code follows our linting rules and includes appropriate tests.

## License

This project is licensed under the terms in the [LICENSE](LICENSE) file.
# Kanban

A simple kanban board to manage project tasks with multiple task owner support.


## Developing

Once you've created a project and installed dependencies with `npm install` (or `pnpm install` or `yarn`), start a development server:

```sh
npm run dev

# or start the server and open the app in a new browser tab
npm run dev -- --open

# To expose to other hosts
DATABASE_URL='postgres:///kanban?host=/var/run/postgresql' npm run dev -- --host
```

## Linting and Pre-commit Checks

Type checking runs automatically before each commit via a Husky pre-commit hook and lint-staged. It runs `svelte-check` on all staged `.ts` and `.svelte` files.

To run type checking manually:

```sh
npm run check
```

To run the pre-commit hook manually (checks only staged files):

```sh
npx lint-staged
```

## Building

To create a production version of your app:

```sh
npm run build
```

You can preview the production build with `npm run preview`.

> To deploy your app, you may need to install an [adapter](https://svelte.dev/docs/kit/adapters) for your target environment.

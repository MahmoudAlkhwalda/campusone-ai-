# CampusOne browser regression

With the CampusOne AI and API Server workflows running, execute:

```sh
pnpm --filter @workspace/campusone-ai run test:e2e
```

The command uses `REPLIT_DEV_DOMAIN` in Replit. Outside Replit, set
`CAMPUSONE_E2E_BASE_URL` to the running application's URL. Override
`PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` when Chromium is not at the Replit default.
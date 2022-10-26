# sveltekit-adapter-firebase

[Firebase](https://firebase.google.com/) adapter for
[SvelteKit](https://github.com/sveltejs/kit).

* SSR on
[Cloud Functions](https://firebase.google.com/docs/hosting/functions)  
* Supports CloudFunctions v2!
  * [Concurrency](https://firebase.google.com/docs/functions/beta/manage-functions#allow_concurrent_requests)  
  * Easier [CORS](https://firebase.google.com/docs/functions/beta/http-events#configuring_cors_cross-origin_resource_sharing)  
  * Built on [CloudRun](https://cloud.google.com/run)  
  * New trigger types  
  * Up to 1hr timeout  
* Local production testing with
[Firebase Emulator](https://firebase.google.com/docs/emulator-suite)

## Getting started

In your standard SvelteKit project:

- `npm install --save-dev sveltekit-adapter-firebase`
- add adapter to `svelte.config.js`:

```diff
+import adapter from "sveltekit-adapter-firebase";

/** @type {import('@sveltejs/kit').Config} */
export default {
  kit: {
+   adapter: adapter(),
  },
};
```
- add `firebase.json` in project root:
```
{
  "hosting": {
    "public": "build",
    "ignore": [
      ".firebase/**"
    ],
    "rewrites": [
      {
        "source": "**",
        "function": "handler", 
      }
    ]
  },
  "functions": [
    {
      "source": "build",
    }
  ]
}
```

## Configuration
The following snippet shows the default configuration.   
V2 is used by default because it allows for concurrency which should drastically reduce costs and cold-starts.
```
/** @type {import('@sveltejs/kit').Config} */
export default {
  kit: {
    adapter: adapter({
      outDir: 'build',
      functionName: 'handler', //needs to correspond to function hosting.rewrites[0].function property in firebase.json
      nodeVersion: '16',
      v2: true,
      functionOptions: {
        concurrency: 500
      }
    }),
  },
};
```
### Region
To configure a region for the SvelteKit Server the `firebase.json` also needs to be adapted as follows  
`svelte.config.js`
```
/** @type {import('@sveltejs/kit').Config} */
export default {
  kit: {
    adapter: adapter({
      functionOptions: {
        region: "europe-west1"
      }
    }),
  },
};
```
`firebase.json`
```
{
  "hosting": {
    "public": "build",
    "ignore": [
      ".firebase/**"
    ],
    "rewrites": [
      {
        "source": "**",
        "function": "handler", 
        "region": "europe-west1"
      }
    ]
  },
  "functions": [
    {
      "source": "build",
    }
  ]
}
```
### Monorepo
Through the `outDir` configuration option the adapter should provide monorepo support (tested with Nx).
`svelte.config.js`
```
/** @type {import('@sveltejs/kit').Config} */
export default {
  kit: {
    adapter: adapter({
      outDir: "../../dist/apps/frontend"
    }),
  },
};
```
`firebase.json` in project root
```
{
  "hosting": {
    "public": "dist/apps/frontend",
    "ignore": [
      ".firebase/**"
    ],
    "rewrites": [
      {
        "source": "**",
        "function": "handler",
      }
    ]
  },
  "functions": [
    //api is added here to present how a backend service might be integrated
    {
      "codebase": "api",
      "source": "dist/apps/api",
      "runtime": "nodejs16"
    },
    {
      "codebase": "frontend",
      "source": "dist/apps/frontend",
      "runtime": "nodejs16"
    }
  ]
}
```
## Beware
`functionOptions` are currently only available on v2 functions. 
If `functionOptions` for v1 are in high demand this might get added later on (**open to PR**).  

V2 also requires the _Blaze_ subscription but offers a free tier of 2 million requests per month.


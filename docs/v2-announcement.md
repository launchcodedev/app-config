---
title: Version 2 Announcement
---

### Announcing App Config, Version 2

We're excited to announce a new major version of App Config, a simple but powerful configuration loading library and CLI.

---

App Config is a great choice for solving the age old configuration question. If you build
software applications, you've ran into this need before.

You might have different databases for production and staging, or different API keys for a
third party service, or maybe you just want the app to behave differently in different deployments.

What kind of apps? We consider everything from frontend SPAs, Node.js servers, CLI utilities, to non-JavaScript servers.
"Jack of all trades" is a stretch, but we're confident that the vast majority of use cases are achievable.

### History

At [Launchcode](lc.dev), we had a lot of client applications. Most projects required at least some backend
services, one or more frontends, and very often mobile apps. The amount of duplication and repetitiveness
of this can easily be imagined. One side of that was configuration. With every service and web page needing
to be different between QA, staging and production, it's apparent that something was needed to manage all of it.

As it stands, the ecosystem tends to revolve around `.env` files. You clone a repo, copy a `.env.sample` file,
and away you go. Then when you need different environments, you make whatever changes are necessary in a somewhat
"hardcoded" feeling way. Oftentimes that means statically configuring `ENV` in dockerfiles, or using custom
bash scripts in deployment. Maybe you've gone past that, and implement a "merging" strategy.

Well, if it's not obvious, we weren't happy with that solution. And it turns out, most libraries that solve a similar
problem are a bit too specific, niche, or tied to a language. That's not exactly ideal.

Beyond that, it felt like there were no guards in place when using `.env`. You'd write validation logic manually.
That's extremely easy to forget, and easy to mess up.

So instead of re-inventing yet another config library with a JavaScript schema, we went about using JSON Schema.
That way, we get the benefit of language agnosticism, strong type constraints, and a highly standard format that's easy to teach.

The evolution of this was very gradual, starting with loading an `APP_CONFIG` environment variable containing JSON.
As needs have arisen, we've found ways to make the developer experience better. The goal of App Config honestly is
to make configuration something so easy that you're encouraged to use it more. Anything that could be adjustable, a feature
flag, or just environment-specific should be instrumented in your app. This makes DevOps way easier, and reduces a lot
of need for re-deployments and small code changes.

### Version 2

We're proud to make a new major version available. It was a full rewrite, using the lessons we learnt in v1.
All of that was done with the goal of enabling "encrypted values". By making the workflow of tools like [git-crypt](https://github.com/AGWA/git-crypt)
a first class citizen, we can ease the onboarding process in new projects. Just trust another user's public
key, and now they can deploy to production.

Of course, a central solution like Hashicorp Vault might suit you best. App Config actually intends to support
Vault as a config provider in the future! That will enable you to use a "local" workflow, but depend on Vault
for production, without ever feeling like switching gears.

Alongside these big features, is the doc pages you're reading right now! We've tried to make App Config accessible
to a much wider audience, and hope to get feedback for improvement.

[Head on over to the introduction](./guide/intro/README.md) for more about App Config and how you can use it.

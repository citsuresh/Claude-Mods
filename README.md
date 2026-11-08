# Claude-Mods
A collection of small mods for Claude Code: UI bands, status indicators and workflow helpers, installable as plugins from one marketplace.

## Install a mod

At a terminal session prompt:

```
/plugin install usage-bar --marketplace citsuresh/Claude-Mods
```

From a shell:

```
claude plugin install usage-bar --marketplace citsuresh/Claude-Mods
```

In the desktop app, where `/plugin` does not run: click + next to the prompt box, then Plugins, Add marketplace with `citsuresh/Claude-Mods`, then Add plugin.

A private repository installs only for people who can read it on GitHub and whose machine has a git credential for github.com.

## Mods

### usage-bar
A band above the prompt showing the current chat's cost for **this month**: `Session cost this month: $4.72`.

- Read live from the engine, with no setup and no files to maintain.
- A chat that runs across months keeps a month baseline (in the mod's saved data), so the figure never includes earlier months. A chat first seen mid-month that started in an earlier month counts from the moment the mod first sees it.
- It does not show the account's monthly spend or limit: a mod cannot read those, and keeping a copy up to date by hand was not worth it. See Settings, then Usage, in the app.

Status: tested on Claude Code engine 2.1.317 with hot reload.

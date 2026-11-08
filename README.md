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
A band above the prompt: a track for the monthly limit, a blue fill for spend so far this month, and a thin red bar inside it for the current session's cost.

- Session cost is read live and counts **this month only**. A chat that runs across months keeps a month baseline (in the mod's saved data), so the red bar never includes earlier months. A chat first seen mid-month that started in an earlier month counts from the moment the mod first sees it.
- Monthly spend cannot be read by a mod. It reads a small JSON file you keep up to date:
  `{ "spent": 36.07, "limit": 200, "currency": "USD", "updatedAt": "2026-11-08" }`
- Set the `monthlyFile` option to that file's full path. Without it, only the session cost shows.

Status: tested on Claude Code engine 2.1.317 with hot reload. The `monthlyFile` option has not been tested yet.

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
A band above the prompt that shows what the current chat costs:

```
Chat total this month $7.43
Cost per turn  ▮▮▮▮▮▮▮  Last turn $0.41
```

- **Cost per turn:** one thin bar per finished turn, newest on the right (darker), scaled to the tallest bar. Hover a bar in the desktop app to see its cost, for example `2 turns ago: $0.18`. Only the last 20 turns are kept (180 px wide at most); older bars drop off the left. In the terminal the bars are text blocks (▁▃▇).
- **Last turn:** the cost of the newest bar.
- **Chat total this month:** this chat's cost for the current calendar month only. A chat that runs across months keeps a month baseline (in the mod's saved data), so the figure never includes earlier months. A chat first seen mid-month that started in an earlier month counts from the moment the mod first sees it.
- Only the main chat's turns count; turns run by helper agents do not add bars.
- Bar heights show cost, not context size. Cost per turn usually rises as a chat grows, because each turn re-reads the conversation, but it is not strict (cached context is cheaper, tool-heavy turns cost more, and a compaction turn is expensive while later turns get cheaper).
- Bars are saved per chat (the last 20 turn costs, as plain dollar amounts, next to the month baseline in the mod's saved data) and come back after an app restart, a plugin update or reopening the chat. Only turns recorded while the mod was running are shown, so a brand-new or never-seen chat starts with `none recorded yet`. Records for chats untouched for 90 days are removed once there are 200 or more chats saved. Nothing is sent anywhere; the saved data stays on this computer.
- It does not show the account's monthly spend or limit: a mod cannot read those, and keeping a copy up to date by hand was not worth it. See Settings, then Usage, in the app.
- No setup, no files to maintain and no network access.

Status: tested on Claude Code engine 2.1.317 with hot reload. The hover tooltips, narrow-window wrapping and the saved bars after a real app restart are the least tested parts.

## Updating

Bump `version` in the mod's `plugin.json` on every change, then push; the app only offers an update when the version changes. To update by hand: `claude plugin marketplace update claude-mods`, then `claude plugin update usage-bar@claude-mods`, then restart Claude.

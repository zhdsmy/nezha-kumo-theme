# Changelog

## [0.1.8] - 2026-11-19

- Show "© year site · Powered by Nezha · Kumo theme" in the footer, with Nezha and the theme linked to their GitHub repositories.
- Show the footer note on its own line below the credits instead of replacing them.
- Show a "No data" placeholder in charts and home tile sparks that have no data yet.

## [0.1.7] - 2026-11-19

- Fade the uncounted download arrow in the outbound-only traffic quota icon.

## [0.1.6] - 2026-11-19

- Draw the traffic quota icons at the same weight as the surrounding text.
- Show an unknown traffic quota as a dash, like other empty billing facts.

## [0.1.5] - 2026-11-19

- Show an icon for the traffic quota type on home page server cards: an infinity sign for unlimited traffic, and arrows for both directions, outbound only, or the larger direction.

## [0.1.4] - 2026-11-18

- Fix admin editors reverting a row to its old values when it is edited and saved a second time.
- Show the server ID next to servers that share a name in admin server selectors.
- Show that exchange rates are unavailable, instead of loading, when the display currency has no quote.

## [0.1.3] - 2026-11-18

- Add Traditional Chinese (Hong Kong) next to Traditional Chinese (Taiwan), each with its own regional wording.
- Use Hong Kong Chinese for Hong Kong and Macau browsers, and keep saved Taiwan selections.
- Show costs in Hong Kong dollars for Hong Kong Chinese and New Taiwan dollars for Taiwan Chinese.
- Use the same language names and globe icon in the public and admin language menus.

## [0.1.2] - 2026-11-18

- Complete missing Simplified Chinese, Traditional Chinese and Japanese translations.
- Read the toast close button label in the interface language.
- Show Simplified Chinese screenshots in the Chinese README and refresh the English ones.

## [0.1.1] - 2026-11-18

- Pick servers by name with one searchable selector in NAT, API tokens, settings and alert rules.
- Show server, group and user names instead of numeric IDs in admin lists.
- Show Webhook fields in DDNS only for the Webhook provider, keeping saved values when switching.
- Search and filter the admin server list by name, ID, IP and group.
- Name server groups and notification groups distinctly and remove duplicate in-page tabs.
- Use wider admin tables and align the public header with the content on wide screens.
- Keep the current sidebar item visible after the window gets shorter.
- Show load charts in two columns on 1024-pixel-wide node pages.
- Fix the empty IP change notification coverage menu and display of dates before 1971.
- Keep user deletion disabled until the signed-in account is confirmed.
- Show localized field labels in validation messages.

## [0.1.0] - 2026-11-18

- Introduce a Kumo-inspired public status page and Nezha management interface.
- Adapt navigation, tables and dialogs to desktop and mobile screens.
- Show live server status, resource use, traffic, region flags and monitoring history.
- Find servers with search, group filters and customizable group icons.
- Display billing cycles, expiry dates, traffic allowances and monthly costs.
- Edit structured public notes while preserving legacy formats and unknown fields.
- Manage servers, monitoring, alerts, users, API tokens, terminal sessions and files.
- Support English, Simplified Chinese, Traditional Chinese and Japanese.
- Offer light, dark and system appearance with keyboard-accessible controls.
- Configure the public theme through panel JSON or a manual config.js file.
- Install and roll back both frontends with Nezha's frontend manager.

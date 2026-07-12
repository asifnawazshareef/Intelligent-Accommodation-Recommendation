# i18n, Layout & UI Guidance

---

## Languages

| Language | Code | Direction |
|----------|------|-----------|
| English (default) | `en` | LTR |
| Urdu | `ur` | RTL |
| Arabic | `ar` | RTL |

Files:

- `client/src/i18n/index.js`
- `client/src/i18n/en.json`
- `client/src/i18n/ur.json`
- `client/src/i18n/ar.json`
- `client/src/components/LanguageSwitcher.jsx`
- `client/src/utils/languageUtils.js`

---

## Rules

1. **Default language = English**  
2. **Do not hardcode UI chrome** — use `t('key')` / translation keys  
3. **Do not translate user-generated content**: property titles, descriptions, reviews, names, emails, phones, image URLs  
4. **Direction-safe layout**: prefer `text-start`, `text-end`, `start-*`, `end-*`, `ms-*`/`me-*` (or logical Tailwind), `flex-wrap`, full-width + responsive grids  
5. Avoid hardcoded `left`/`right` that break RTL  

---

## When adding UI text

1. Add key to `en.json`  
2. Add same key to `ur.json` and `ar.json`  
3. Use the key in the component  
4. Manually check the page in Urdu or Arabic  

---

## Surfaces that must work in all languages

- Navbar / footer  
- Auth forms  
- Search form + cards  
- Property detail  
- Booking + payment steps  
- Dashboards (guest/owner/admin)  
- Tables (admin users, image audit, listings)  
- Offline request forms/cards  
- Recommendation sections  

---

## Theme

`ThemeContext` + `ThemeToggle` exist for light/dark cosmetic switching. Do not expand into a separate “product dark-mode feature set” beyond existing behaviour; keep focus on workflow UX.

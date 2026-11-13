---
name: verify-magazine-tracking
description: Start the magazine shipment lookup site and drive the reader flow. Use after changing the lookup page, the lookup API, sample import, or carrier links.
---

# Verify magazine tracking

Run this from `magazine-tracking/` when the lookup page, `/api/lookup`, or the sample import changes:

```bash
node scripts/verify-site.mjs
```

The script starts `next dev` on port 4173 with a temporary database, imports the fictional sample file through the admin API, then drives Chrome:

1. Load `/` and check the lookup heading.
2. Reject a partial phone number.
3. Send a code through the console SMS provider, reject a wrong code, then accept the logged code.
4. Check that `13800001111` sees only `DEMO-YD-000001` and `DEMO-ZT-000002`, and a request body naming another phone cannot read that phone's rows.
5. Click 查询物流 and check the clipboard.
6. Repeat the login at 390px for `13900002222` and check the China Post link.

It prints `PASS` lines and exits 0, or `FAIL` and exits 1. It does not open WeChat DevTools. `npm test` still covers the mini program jump logic in Node.

## Feature map

| Surface | What it does |
| --- | --- |
| `/` | Reader enters a full mobile number and sees magazine name, ship date, method, and tracking number |
| `/api/lookup` | `POST { "phone" }`. Exact match only. No name, address, phone, or order number in the response |
| Result card | Copy the tracking number. 韵达, 中通, and 中国邮政 EMS open a fixed official page; the number is not put in the URL |
| `/admin` | Sign in, preview an `.xlsx` or CSV, then commit. Names and addresses are not stored |
| `miniprogram/` | Same phone lookup, plus 韵达 / 中通 / 中国邮政 EMS buttons that call `wx.navigateToMiniProgram` after copying the number |
| `离线演示.html` | Static fictional records. Not the server |

# personal

## 刊邮

杂志邮寄单号查询的源码在 `magazine-tracking/`。把代码上传到 GitHub 不会自动变成可公开访问的网站，需要在自己的电脑上运行。

需要 Node.js 22。进入该目录后：

```bash
cd magazine-tracking
npm install
cp .env.example .env.local
```

在 `.env.local` 里自行填写 `ADMIN_USERNAME`、`ADMIN_PASSWORD` 和 `ADMIN_SESSION_SECRET`，然后执行 `npm run dev`。读者页一般是 http://localhost:3000 ，管理人员入口是 `/admin`。示例记录都是虚构的。更完整的说明见 `magazine-tracking/README.md`。

微信小程序源码在 `magazine-tracking/miniprogram/`。用微信开发者工具导入该目录即可预览。`project.config.json` 里的 `touristappid` 只是占位，发布前要换成自己的 AppID，并在小程序后台配置 request 合法域名。把代码上传到 GitHub 不会发布小程序，也不会变成可公开访问的网站。运行、打开和提审的短说明在 `magazine-tracking/README.md` 的「运行网站、打开小程序、提交发布」。

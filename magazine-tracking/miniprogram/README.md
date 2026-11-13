# 订阅单号查询小程序

原生微信小程序，用来按完整手机号查询已经导入的杂志订阅单号。表格导入仍在网站 `/admin`，不在小程序里。

当前仓库没有填写 AppID，也没有在真机上打开过韵达。这不是已经可以提交审核的状态。把源码放进 GitHub 不会发布小程序。

## 本地打开

用微信开发者工具导入 `magazine-tracking/miniprogram`。基础库使用 3.5.5 或更新版本。`project.config.json` 里的 `appid` 是空的，导入时换成你自己的小程序 AppID。本机的 AppID 可以写在 `project.private.config.json`，这个文件已被忽略，不要提交。

在 `config.js` 填写 `apiBase`，例如 `https://lookup.example.com`。不要带路径、端口或密码。开发者工具若勾选「不校验合法域名」，只能用于临时演示。`trycloudflare` 域名默认会被拒绝。

查询接口沿用网站的 `POST /api/lookup`，请求体只有 `{ "phone": "完整手机号" }`。

## 复制成功

「复制单号」只调用 `wx.setClipboardData`，把快递单号写入剪贴板。官方接口的作用是复制，不读取剪贴板，本程序也不调用 `wx.getClipboardData`。

复制成功的提示是：「单号已复制。这只是复制成功，不会自动打开快递公司小程序。」写入失败时提示长按单号手动复制，并且不发起跳转。

复制回调里不会调用 `wx.navigateToMiniProgram`。

## 参数模拟测试

在 `magazine-tracking` 目录执行 `npm test`。其中小程序用例用 Node 模拟 `wx.setClipboardData`、`wx.navigateToMiniProgram` 和 `wx.request`。

这些测试检查：号码校验、只提交手机号、结果去掉姓名地址和手机号、缺少接口地址、限流和失败、复制成功与失败、取消跳转、未核对的中通配置不会调用跳转、韵达跳转的 `path` 为空且 `extraData` 是空对象。单号和手机号都不会被拼进跳转参数。

这不是微信开发者工具的编译结果，也不是手机上的跳转结果。

## 真机跳转验证

尚未在真实手机上验证跳转。开发者工具不能真正打开另一个小程序，工具里的成功或失败都不能当成手机上已经跳转。

韵达只在你再点一次「打开韵达首页」后调用 `wx.navigateToMiniProgram`。微信会再弹确认框，取消时走 `fail cancel`。参数是开放平台文档里的 AppID `wxdeb5309aa3e93fd1`，`path` 为空，不传 `extraData`。界面固定写着「仅打开首页，需自行粘贴查询。」文档里的查件路径是图片，没有可用的文本参数，所以不会自动查询。

中通联系页只有二维码，没有已核对的 AppID 和路径，页面上没有跳转按钮。

上架前要你自己完成的事项见 `上架清单.md`。

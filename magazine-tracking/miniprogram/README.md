# 订阅单号查询小程序

原生微信小程序，用来按完整手机号查询已经导入的杂志订阅单号。表格导入仍在网站 `/admin`，不在小程序里。

`project.config.json` 的 `appid` 是微信开发者工具占位 `touristappid`，不是可以上传的正式 AppID。把源码放进 GitHub 不会发布小程序。

## 本地打开

用微信开发者工具导入 `magazine-tracking/miniprogram`。基础库使用 3.5.5 或更新版本。导入后如果只是预览，可以先留着 `touristappid`。要上传或真机预览自己的项目时，把 `appid` 换成你在微信公众平台注册的小程序 AppID。本机覆盖可以写在 `project.private.config.json`，这个文件已被忽略，不要提交。

在 `config.js` 填写 `apiBase`，例如 `https://lookup.example.com`。不要带路径、端口或密码。开发者工具若勾选「不校验合法域名」，只能用于临时演示。`trycloudflare` 域名默认会被拒绝。

查询接口沿用网站的 `POST /api/lookup`。请求体不带手机号。先用微信手机号或短信验证码换取服务器签发的 token，再放在 `Authorization: Bearer` 里。

## 复制成功

「复制单号」只调用 `wx.setClipboardData`，把快递单号写入剪贴板。官方接口的作用是复制，不读取剪贴板，本程序也不调用 `wx.getClipboardData`。

复制成功的提示是：「单号已复制。这只是复制成功，不会自动打开快递公司小程序。」写入失败时提示长按单号手动复制，并且不发起跳转。

复制回调里不会调用 `wx.navigateToMiniProgram`。

## 参数模拟测试

在 `magazine-tracking` 目录执行 `npm test`。其中小程序用例用 Node 模拟 `wx.setClipboardData`、`wx.navigateToMiniProgram` 和 `wx.request`。

这些测试检查：没有 token 不会发查询、查询请求不带手机号、结果去掉姓名地址和手机号、缺少接口地址、限流和失败、复制成功与失败、取消跳转。韵达、中通、中国邮政 EMS 的跳转 `path` 为空且 `extraData` 是空对象；有单号时会先写入剪贴板。单号和手机号都不会被拼进跳转参数。

这不是微信开发者工具的编译结果，也不是手机上的跳转结果。

## 真机跳转验证

尚未在真实手机上验证跳转。开发者工具不能真正打开另一个小程序，工具里的成功或失败都不能当成手机上已经跳转。

三个按钮都会调用 `wx.navigateToMiniProgram`。微信会再弹确认框，取消时走 `fail cancel`。`path` 为空，不传 `extraData`。有对应快递的单号时，先复制再跳转，并提示粘贴。

| 快递 | AppID | 来源 |
| --- | --- | --- |
| 韵达快递 | `wxdeb5309aa3e93fd1` | [韵达开放平台《微信小程序嵌入》](https://yundaex.apifox.cn/doc-345776) |
| 中通快递 | `wx7ddec43d9d27276a` | [腾讯应用宝「中通快递」](https://sj.qq.com/appdetail/wx7ddec43d9d27276a)，开发者为中通快递股份有限公司。与[微信雷达公开片段](https://appid.gqmg.com/mp/wA4Khesetr5u) `wx7ddec****d27276a` 一致 |
| 中国邮政 EMS | `wx63e410bc2c6a792e` | [腾讯应用宝「EMS中国邮政速递物流」](https://sj.qq.com/appdetail/wx63e410bc2c6a792e)，开发者为中国邮政速递物流股份有限公司。与[微信雷达公开片段](https://appid.gqmg.com/mp/uGT49ez_dztD) `wx63e41****c6a792e` 一致 |

韵达文档里的查件路径是图片，中通和 EMS 没有查到官方文本 path，所以三家都不把单号放进 `path` 或 `extraData`。

上架前要你自己完成的事项见 `上架清单.md`。

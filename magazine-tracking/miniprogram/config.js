/**
 * 上架前只改这两个值。不要把 AppSecret、管理员密码或数据库路径写到这里。
 * apiBase 例：https://lookup.example.com （不要带路径、端口、账号或密码）
 * trycloudflare 临时域名不能作为正式接口。演示时才把 allowDemoTunnel 临时设为 true，上传前改回 false。
 */
const runtimeConfig = {
  apiBase: "",
  allowDemoTunnel: false,
};

module.exports = {
  runtimeConfig,
};

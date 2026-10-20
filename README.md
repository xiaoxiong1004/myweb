# 蓝生万物 · 苗族蜡染互动网页

这是纯静态网页，使用 HTML、CSS、原生 JavaScript、Three.js 和 GSAP。无数据库、无后端、无环境变量。现有画面、动画、交互代码保持不变。

## Vercel
导入此仓库根目录即可。vercel.json 已设置：框架 Other、构建命令 node scripts/build.mjs、输出目录 dist。没有需要安装的第三方 npm 依赖。

构建时会检查 JavaScript 语法、入口资源路径、25 张图片的 SHA-256 校验值以及本机地址残留，再将运行文件复制到 dist。不要手动上传 dist；Vercel 会自动生成。

## 资源
media.js 现在只保存同源相对图片路径，图片位于 assets。图片从上一版本内嵌数据逐字节拆出，没有重新压缩或修改。最大单文件约 3.47 MB，方便 GitHub 网页上传。字体使用系统宋体字体族，不依赖本机字体文件路径；不同设备的系统字体可能略有差异。

上传时保留 assets、vendor、scripts 文件夹结构，以及根目录全部文件，尤其是 vercel.json、package.json、asset-hashes.json。

## 设备和保存
电脑与手机可通过部署后的 HTTPS 网址访问。动画需要浏览器支持 WebGL，触摸和键盘操作沿用原实现。移动设备的运行流畅度取决于硬件，本轮未做真实手机性能测试。

作品收藏通过 localStorage 保存在每个人自己的浏览器内，不跨设备同步；PNG 导出仍在浏览器完成。初次进入新域名不会自动出现 localhost 下保存的作品。

## 本轮验证
已执行 node scripts/build.mjs，构建通过。25 张图片 SHA-256 与原图一致；index.html、app.js、fabric.js、style.css 和 vendor 库与原版本内容一致，保证此次只调整资源组织及部署配置。未登录 Vercel，尚未进行云端真实部署。

注意：原使用说明中的“图片嵌入 media.js、无需 assets”描述仅适用于旧离线包。本部署版本必须携带 assets 文件夹。

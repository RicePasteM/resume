# Resume · 胡张驰 / Zhangchi Hu

[GitHub Pages](https://ricepastem.github.io/resume/) · [原站简历](https://ricepastem.cafe/resume)

原站简历的独立静态版本，复用 Cafe 项目的简历组件与样式，保留论文精选 / 全部切换、详情展开、侧边目录、字符终端、深色模式及 PDF 导出。

## 自动同步

GitHub Actions 在推送到 `master`、手动运行和每小时 UTC 第 17 分钟时执行：

1. 从原站简历 HTML 中解析 Nuxt 内嵌的 `active-resume` 数据快照，完整保留作者、精选标记与论文链接，不执行原站脚本。
2. 下载原站 PDF 字体到构建目录，核对清单及文件长度，后续构建复用 GitHub Actions 缓存。
3. 用 Nuxt 预渲染静态 HTML，验证资源路径后部署到 GitHub Pages。

页面内容和 PDF 字体随构建同步；页面组件与样式保存在本仓库，可独立维护。访问 Pages 时不请求原站数据或字体，不需要令牌、数据库或后端服务器。`sync.json` 记录当前部署的来源、获取时间和内容 SHA-256。

定时运行由 GitHub 调度，可能延迟。原站不可用、响应为空或资源损坏时会终止部署，线上保留上次成功版本。公开仓库长期无活动时，GitHub 可能停用定时任务，可在 Actions 中重新启用。

## GitHub Pages 设置

在 **Settings → Pages → Build and deployment → Source** 选择 **GitHub Actions**。工作流使用官方 `configure-pages`、`upload-pages-artifact` 和 `deploy-pages` Actions；无需配置 Secrets。

需要立即同步时，在 **Actions → Sync resume and deploy Pages → Run workflow** 手动运行。更改同步频率可编辑 `.github/workflows/pages.yml` 的 `schedule`。

## 本地使用

需要 Node.js 22 或更新版本。

```sh
npm ci
npm test
npm run build
npm run dev
```

`npm run build` 会访问原站；`npm run generate` 使用现有简历快照（PDF 字体需先通过 `npm run sync` 下载）。默认基础路径是 `/resume/`，本地访问 `http://localhost:3000/resume/`。部署到其他路径时设置 `NUXT_APP_BASE_URL`，例如 `NUXT_APP_BASE_URL=/ npm run build`。

仓库中的 `app/data/resume.json` 是首次创建时的公开内容快照。定时构建将最新数据写入部署产物，不自动产生 Git 提交；实际线上版本以 `sync.json` 为准。

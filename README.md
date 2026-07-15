# 练迹 · FITLOG

<p align="center">
  <img src="./public/icon-192.png" alt="练迹应用图标" width="112" />
</p>

一款为手机设计的训练计划与日志应用。可以维护六部位分化计划、组合当天训练、逐组打卡、查看历史统计，并把任意一天的训练生成为可直接访问的只读链接。

**在线体验：** [https://zhyio.github.io/fitlog-mobile/](https://zhyio.github.io/fitlog-mobile/)

## 当前功能

### 今日训练

- 从胸、肩、背、腿、核心、有氧六个分化中选择一个或多个部位
- 自动合并所选分化的动作，并用独立配色区分不同部位
- 支持添加自定义动作，记录目标组、次数、重量、额外组和动作要领
- 使用圆形按钮逐组打卡；目标组使用实线圆，超频组使用虚线圆
- 默认保留 2 个超频组入口，点满后自动增加新的超频组
- 记录训练时长、身体状态和训练反馈

### 分化计划

- 为六个训练部位分别维护动作库
- 支持新增、编辑和删除分化动作
- 可复用最近训练过的动作参数
- 分化计划会作为模板注入当天训练，不影响模板本身的完成进度

### 历史与统计

- 按月份查看训练记录和单次训练详情
- 汇总训练次数、总时长和训练容量
- 展示最近 7 天训练时长与常练动作
- 计算连续训练天数
- 导出 JSON 格式的训练数据备份

### 分享、同步与离线使用

- 将单次训练编码进 URL，可复制链接、调用系统分享或打开预览
- 分享页只展示该次训练的只读快照，不会带出其他历史记录
- 使用 Supabase 保存分化计划和训练记录
- 云端不可用时继续使用浏览器本地缓存，后续保存时再次尝试同步
- 支持添加到手机主屏幕，并通过 Service Worker 提供离线访问能力

## 界面设计

- 移动端优先，兼容安全区域和窄屏布局
- 苔藓绿森林色调、玻璃质感卡片和轻拟物交互
- 六个训练部位使用不同颜色与简约线性图标
- 使用原创生成的黑猫健身陪练素材，覆盖今日训练、历史和统计场景
- 尊重系统的“减少动态效果”设置

## 数据模型

Supabase 使用四张规范化数据表：

| 表 | 用途 |
| --- | --- |
| `training_plans` | 六个部位的分化计划 |
| `plan_exercises` | 分化计划中的动作模板 |
| `workouts` | 每日训练日志 |
| `workout_exercises` | 每次训练的动作与完成组数 |

前端通过以下 RPC 读取和保存完整快照：

- `load_fitlog_snapshot`
- `save_fitlog_snapshot`

数据库迁移文件位于 [`supabase/migrations`](./supabase/migrations)：

1. `202607130001_fitlog_v2.sql`：重建 v2 表结构、约束、RLS 与 RPC
2. `202607130002_safe_snapshot_sync.sql`：修正空表删除时的快照保存逻辑

> [!WARNING]
> 第一份迁移包含旧表删除与结构重建，仅适合初始化或明确的数据重置场景。已有环境执行前请先备份。

当前同步模型面向个人单实例使用，所有客户端连接同一个数据空间。若要支持多用户，请先接入 Supabase Auth，并为四张表增加 `user_id`、按用户隔离的 RLS 策略和按用户读写的 RPC。

## 技术栈

- React + TypeScript
- Vite
- Lucide React
- Supabase REST RPC
- PWA Manifest + Service Worker
- GitHub Actions + GitHub Pages

## 本地开发

建议使用 Node.js 22（与 GitHub Actions 部署环境一致）。

```bash
npm install
npm run dev
```

如需连接自己的 Supabase 项目，可在 `.env.local` 中配置：

```dotenv
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
```

浏览器端只能使用 Supabase Publishable Key。不要把 Secret Key、`service_role` Key 或数据库密码写入前端代码、环境文件示例或 GitHub 仓库。

## 构建与预览

```bash
npm run build
npm run preview
```

`npm run build` 会先执行 TypeScript 类型检查，再生成 `dist` 静态文件。

## 部署

仓库的 [GitHub Actions 工作流](./.github/workflows/deploy.yml) 会在代码推送到 `main` 后自动：

1. 使用 Node.js 22 安装依赖
2. 执行生产构建
3. 上传 `dist`
4. 发布到 GitHub Pages

也可以在 GitHub Actions 页面手动触发 `Deploy to GitHub Pages`。

## 项目结构

```text
fitlog-mobile/
├── public/                  # PWA 图标、Manifest 与 Service Worker
├── src/
│   ├── assets/              # 原创生成的健身陪练素材
│   ├── App.tsx              # 训练、历史、统计与分享界面
│   ├── db.ts                # Supabase 快照读写
│   └── *-theme.css          # 森林、玻璃与角色主题样式
├── supabase/migrations/     # 数据库结构与 RPC 迁移
└── .github/workflows/       # GitHub Pages 自动部署
```

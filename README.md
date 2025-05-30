# GitHub Proxy & Shortener

一个现代化的 GitHub 代理工具，帮助解决纯 IPv6 环境下访问 GitHub 资源的问题，并提供脚本命令转换功能。

## 简介

GitHub Proxy & Shortener 是一个基于 Cloudflare Workers 的工具，用于解决以下问题：

- 在纯 IPv6 的 VPS 上运行 GitHub 脚本时无法访问 GitHub 的问题
- 需要通过代理访问 GitHub 资源的场景
- 简化 GitHub 一键脚本的使用

本项目是对 [hunshcn/gh-proxy](https://github.com/hunshcn/gh-proxy) 的改进和扩展，增加了更友好的用户界面和更多功能支持。

## 特性

- **脚本命令转换**：将原始 GitHub 脚本命令转换为使用代理的版本
  - 支持处理一层脚本中的 GitHub 资源
  - 支持处理嵌套调用其它 GitHub 脚本的情况
- **资源链接转换**：将 GitHub 资源链接转换为代理链接
- **支持多种资源类型**：
  - GitHub Releases 和 Archives
  - Raw 文件内容
  - Blob 文件
  - Git 仓库 (支持 clone)
  - Gist 文件
  - API 请求 (api.github.com)
  - Git.io 短链接
- **现代化界面**：采用 Tailwind CSS 构建的简洁、响应式界面

## 使用方法

### 脚本命令转换

1. 访问工具页面
2. 输入原始的 GitHub 脚本命令，例如：
   ```
   bash <(curl -L https://github.com/crazypeace/warp.sh/raw/main/warp.sh) 4
   ```
3. 点击"转换脚本"按钮
4. 根据需要选择合适的转换结果：
   - 只处理一层脚本中 GitHub 资源
   - 处理嵌套调用的情况
5. 复制转换后的命令并在终端中执行

### 资源链接转换

1. 访问工具页面
2. 输入 GitHub 资源链接，例如：
   ```
   https://github.com/crazypeace/warp.sh/raw/main/warp.sh
   ```
3. 点击"转换资源"按钮
4. 复制转换后的链接或直接点击"获取"按钮

### 支持的脚本格式

- `bash <(curl -L https://github.com/user/repo/raw/branch/file.sh) args`
- `bash <(wget -qO- -o- https://git.io/xxxx)`
- `wget -O file.sh "https://git.io/xxxx" && chmod +x file.sh && ./file.sh`
- `wget -N --no-check-certificate https://raw.githubusercontent.com/user/repo/branch/file.sh && bash file.sh`

### 高级参数

工具页面底部的"高级参数"部分允许您设置自定义的 GitHub 代理服务器 URL。这对于使用自己部署的代理服务器的用户很有用。

## 项目结构

```
.
├── public/                 # 静态资源目录
│   ├── index.html          # 主页面 HTML
│   ├── main.js             # 客户端 JavaScript 逻辑
│   └── styles.css          # 自定义样式表
├── src/                    # 源代码目录
│   └── index.js            # Worker 主逻辑代码
├── wrangler.toml           # Cloudflare Workers 配置文件
├── package.json            # 项目依赖配置
├── webpack.config.js       # Webpack 配置
├── LICENSE                 # 许可证文件
└── README.md               # 项目说明文档
```

### 文件作用说明

- **src/index.js**: 核心代理逻辑，处理请求转发、URL 重写等功能
- **public/index.html**: 用户界面，提供脚本转换和链接转换功能
- **public/main.js**: 处理用户交互和转换逻辑的客户端代码
- **public/styles.css**: 自定义样式，补充 Tailwind CSS 框架
- **wrangler.toml**: Cloudflare Workers 配置，定义部署参数
- **package.json**: 定义项目依赖，主要是 @cloudflare/kv-asset-handler 用于处理静态资源

## 部署指南

### 在 Cloudflare Workers 上部署

1. 克隆本仓库
   ```
   git clone https://github.com/Snarl3908/ghProxyNShorten.git
   cd ghProxyNShorten
   ```

2. 在 Cloudflare Workers 控制台导入部署
   - 登录 [Cloudflare Workers 控制台](https://dash.cloudflare.com/?to=/:account/workers/overview)
   - 点击"创建服务"或"Create a Service"
   - 选择"从 Git 部署"选项
   - 连接您的 GitHub 账户并选择本仓库
   - 配置必要的设置（如项目名称等）
   - 点击部署

3. 或者使用 Wrangler CLI 部署
   ```
   npm install
   npx wrangler deploy
   ```

## 技术栈

- **前端**：HTML, CSS, JavaScript, Tailwind CSS
- **后端**：Cloudflare Workers (JavaScript)
- **构建工具**：Webpack
- **依赖管理**：npm

## 项目引用

本项目基于以下开源项目和技术：

- [hunshcn/gh-proxy](https://github.com/hunshcn/gh-proxy) - 原始的 GitHub 代理项目
- [Cloudflare Workers](https://workers.cloudflare.com/) - 无服务器计算平台
- [Tailwind CSS](https://tailwindcss.com/) - 实用优先的 CSS 框架
- [@cloudflare/kv-asset-handler](https://github.com/cloudflare/kv-asset-handler) - 用于 Workers Sites 的静态资源处理库

## 许可证

本项目采用 MIT 许可证 - 详见 [LICENSE](LICENSE) 文件

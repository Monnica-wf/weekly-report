# 🚀 部署到 GitHub Pages 指南

## 方法一：通过 GitHub 网页操作（推荐）

### 1. 创建 GitHub 仓库
1. 访问 [GitHub](https://github.com)
2. 点击右上角 **+** → **New repository**
3. 仓库名填写：`weekly-report`
4. 选择 **Public**（公开）
5. 点击 **Create repository**

### 2. 上传文件
**方式 A：使用 Git 命令行**

```bash
# 进入项目目录
cd /Users/didi/weekly-report

# 添加远程仓库（替换 YOUR_USERNAME 为你的 GitHub 用户名）
git remote add origin https://github.com/YOUR_USERNAME/weekly-report.git

# 推送到 GitHub
git branch -M main
git push -u origin main
```

**方式 B：网页上传**
1. 在刚创建的仓库页面，点击 **uploading an existing file**
2. 拖拽以下文件到上传区域：
   - `index.html`
   - `css/style.css`
   - `js/app.js`
   - `js/storage.js`
   - `README.md`
   - `.nojekyll`
3. 点击 **Commit changes**

### 3. 启用 GitHub Pages
1. 进入仓库 **Settings** 标签
2. 左侧菜单找到 **Pages**
3. **Source** 选择 **Deploy from a branch**
4. **Branch** 选择 **main**，文件夹选择 **/(root)**
5. 点击 **Save**
6. 等待 1-2 分钟部署完成

### 4. 访问网站
部署完成后，访问地址：
```
https://YOUR_USERNAME.github.io/weekly-report/
```

---

## 方法二：使用 GitHub Desktop

1. 下载并安装 [GitHub Desktop](https://desktop.github.com/)
2. 打开应用，登录 GitHub 账号
3. **File** → **Add Local Repository**
4. 选择 `/Users/didi/weekly-report` 目录
5. 点击 **Publish repository**
6. 仓库名：`weekly-report`，选择 **Public**
7. 点击 **Publish repository**
8. 按照上面「启用 GitHub Pages」步骤操作

---

## 方法三：使用 VS Code

1. 安装 VS Code 扩展：**GitHub**
2. 打开 `/Users/didi/weekly-report` 文件夹
3. 点击左侧源代码管理图标
4. 点击 **Publish to GitHub**
5. 选择仓库名和可见性
6. 按照上面「启用 GitHub Pages」步骤操作

---

## 🎉 部署完成后

### 分享带数据的网址
部署后的普通网址只会打开周报工具本身。你在页面里录好内容后，点击右上角 **分享链接**，页面会复制一个带 `#share=` 的网址；把这个网址发给别人，对方打开后就能看到你当时打包进去的周报、链接笔记和评论。

注意：上传的文件本体不会塞进网址里，只会共享文件名和大小；网页链接型笔记可以正常共享。

### 自定义域名（可选）
1. 在仓库根目录创建 `CNAME` 文件
2. 文件内容填写你的域名，如：`weekly.yourdomain.com`
3. 在域名服务商处配置 DNS：
   - 类型：CNAME
   - 名称：weekly
   - 值：YOUR_USERNAME.github.io

### 更新网站
```bash
# 修改文件后
git add .
git commit -m "更新说明"
git push
```
GitHub Pages 会自动重新部署（通常 1-2 分钟）

---

## ❓ 常见问题

### Q: 页面显示 404
A:
1. 确认 GitHub Pages 已启用
2. 等待 1-2 分钟部署完成
3. 检查 `index.html` 是否在根目录

### Q: 样式不生效
A:
1. 确认 `.nojekyll` 文件存在
2. 清除浏览器缓存后重试

### Q: 数据会丢失吗？
A: 数据存储在浏览器 localStorage 中，不会上传到 GitHub，关闭浏览器不会丢失。清除浏览器数据会导致数据丢失，建议定期导出备份。

---

## 📊 部署状态检查

部署后可以添加徽章到 README.md：

```markdown
![Deploy Status](https://github.com/YOUR_USERNAME/weekly-report/actions/workflows/pages/pages-build-and-deployment/badge.svg)
```

---

需要帮助？查看 [GitHub Pages 文档](https://docs.github.com/zh/pages)

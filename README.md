# Open in New Window

右键文件或文件夹, 在新的 VSCode 窗口中打开对应目录作为工作区。

支持本地开发和远程开发(如 SSH Remote)。

## 功能

| 右键目标 | 菜单项 | 行为 |
|---------|--------|------|
| 文件(文件树 / 标签栏) | 新窗口打开(父目录) | 以文件所在目录为工作区打开新窗口 |
| 文件夹(文件树) | 新窗口打开(此目录) | 以该文件夹为工作区打开新窗口 |

## 安装

在 VS Code 扩展市场搜索 **Open in New Window** 安装, 或通过 `.vsix` 文件手动安装:

```bash
code --install-extension open-new-window-x.x.x.vsix
```

## 发版

推送 `v*` 格式的 tag 即可触发 GitHub Actions 自动发布:

```bash
git tag v0.0.3
git push origin v0.0.3
```

需要在仓库 Settings → Secrets 中配置 `VSCE_PAT`(VS Code Marketplace Personal Access Token)。

## License

MIT

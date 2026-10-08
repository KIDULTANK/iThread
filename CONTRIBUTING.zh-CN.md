# 为 iThread 做贡献

**简体中文 | [English](CONTRIBUTING.md)**

感谢你帮助改进 iThread。欢迎提交错误报告、可复现的兼容性样本，以及范围明确的 Pull Request。

## 提交问题前

1. 查看[已知限制](docs/KNOWN_LIMITATIONS.zh-CN.md)；
2. 确认问题可以在最新公开测试版中重现；
3. 删除测试导图中的个人信息和保密内容；
4. 使用仓库提供的结构化 Issue 模板，并写明准确的重现步骤。

## 本地开发

项目需要 Node.js 22 和 pnpm 11：

```powershell
pnpm install --frozen-lockfile
pnpm gate
```

Pull Request 应保持完整质量门禁通过，并为行为变化增加测试。请勿加入遥测、强制云服务，或
未经用户明确操作便上传导图内容的代码。

## iThoughts 兼容性样本

只能提交你有权公开分享的文件。优先制作最小化的虚构 `.itmz` 测试样本；如确实需要真实导图，
请先把姓名、备注、链接、图片和附件替换为不敏感的测试数据，再附加到公开 Issue。

# iThread 中文快速上手

iThread v0.1.1 是面向 Windows 11 的公开预览版。它可以导入 iThoughts `.itmz` 文件，但目前
不能把修改重新导出为 `.itmz`。第一次测试时请务必保留原文件，并优先使用副本。

## 1. 下载和启动

1. 从 [GitHub Releases](https://github.com/KIDULTANK/iThread/releases) 下载
   `iThread-0.1.1-Windows-x64.exe`。
2. 对照同一 Release 中的 `SHA256SUMS.txt` 核对文件校验值。
3. 当前版本尚未取得代码签名。Windows SmartScreen 如提示“未知发布者”，请先确认下载地址
   和 SHA-256，再决定是否运行。
4. 本版本为便携版，不需要安装；双击即可启动。

## 2. 导入 iThoughts 文件

1. 进入开始页，选择“导入文件”。
2. 选择 `.itmz` 文件；建议只选择备份副本。
3. 检查主题层级、备注、链接、图片、折叠状态和任务进度。
4. 导入是转换操作，原始 `.itmz` 不会被修改。

## 3. 保存编辑结果

- 日常编辑建议保存为 `.mmst`，这是 iThread 的原生无损格式。
- `.json` 可用于完整备份或排查问题。
- `.mm`、`.opml`、`.mmap` 和 Markdown 等格式适合交换，但可能丢失部分样式或元数据。
- 当前不能保存为 iThoughts 可重新打开的 `.itmz`。

## 4. 常用操作

- `Enter`：结束当前主题编辑；未编辑时创建同级主题。
- `Tab`：创建下级主题。
- `F2` 或 `Ctrl+Enter`：编辑选中主题。
- `Alt+方向键`：移动主题或分支位置。
- `P` / `Shift+P`：增加或减少任务进度。
- 长按 `Alt`：显示中文快捷键总览。

应用内可切换中文或英文界面。快捷键总览支持分页查看。

## 5. 反馈问题

请通过 [GitHub 问题模板](https://github.com/KIDULTANK/iThread/issues/new/choose) 提交，并尽量提供：

- iThread 版本和 Windows 版本；
- 可重复的操作步骤；
- 实际结果和预期结果；
- 截图或录屏；
- 脱敏后的 `.itmz` 样本，或能够重现问题的最小测试文件。

不要公开上传含有个人信息、工作秘密或未公开资料的原始导图。

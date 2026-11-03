# iThoughts 功能差距 · 2026-11-03

**简体中文 | [English](#english)**

依据 [iThoughts 官方功能对照表](https://www.toketaware.com/ithoughts-faq-features)
与[官方帮助](https://www.toketaware.com/ithoughts-help)，核对 iThread v0.7.1 的编辑器、
文件解析、导出和平台通道。这里的“缺失”指没有对应产品功能；“部分”指已有近似流程，但没有达到原版同等范围。

| 官方功能 | iThread 现状 | 建议 |
|---|---|---|
| [闪卡导出](https://www.toketaware.com/ithoughts-howto-flashcards) | 缺失。已有普通表格复制和大纲导出，但没有正反面配对 | **优先**：选区导出为两列 TSV，支持 Anki／Quizlet 的常见导入流程 |
| [多条件持续排序、随机排序](https://www.toketaware.com/ithoughts-howto-sorting) | 部分。支持按标题、优先级、截止日、进度一次排序；没有保存规则、分支级继承和洗牌 | **优先**：分支复习随机排序，以及可撤销的多条件一次排序，再考虑持续规则 |
| [密码保护的导图](https://www.toketaware.com/ithoughts-howto-encrypt) | 缺失。没有原生文件密码保护或加密 `.itmz` 导入流程 | **优先设计**：分别考虑密码格式兼容与原生文件加密；同时覆盖草稿、历史和同步副本 |
| [主题文字研究／查词](https://www.toketaware.com/ithoughts-howto-research) | 缺失。现有查找面向文件库和导图内部 | 可加入显式触发的网页查询与本地词典入口 |
| [LaTeX 公式](https://www.toketaware.com/ithoughts-howto-latex) | 缺失。已有 Markdown 行内样式，未渲染公式 | 优先考虑离线渲染，以及 PNG、PDF 和打印的一致性 |
| 自由手绘、手绘风格 | 缺失。已有画布形状、背景和图片，没有手写笔笔迹或全图手绘风格 | 平板优先；原版手绘工具为 iOS 功能，手绘风格则覆盖多个平台 |
| [日历／提醒事项](https://www.toketaware.com/ithoughts-howto-calendarreminder-integration)、Things | 部分。已有开始日、截止日和议程视图，未提供原生日历／提醒或 Things 交接 | 先做离线 `.ics` 导出；原版日历／提醒集成面向 Apple 平台 |
| 任务成本、工时和汇总 | 部分。已有进度、优先级和日期；部分格式可读资源字段，缺少完整成本／工时编辑和汇总 | 需求明确后再做，以免复杂化普通主题编辑 |
| 自动、局部自动和手动布局 | 部分。已有自动布局、自由画布、节点布局和分支配平，尚未逐项实现原版局部自动排列行为 | 有真实样例时优先验证局部固定与 `.itmz` 位置往返 |
| [高级筛选](https://www.toketaware.com/ithoughts-howto-filter) | 部分。已有结构化条件、查询语法、淡化和隐藏；规则字段、语法及匹配分支展开策略有差异 | 补常用日期、属性条件及可选的“展开匹配分支” |
| 云盘及系统集成 | 部分。Windows 与安卓预览有手动 WebDAV，Windows 可使用系统同步文件夹；没有原生 iCloud、Dropbox、OneDrive 账号通道或 Apple Handoff | 先把现有单人多设备流程和冲突恢复做稳 |
| 小众文件格式 | 部分。未发现 ConceptDraw、MindView、NovaMind、iMindMap、MyThoughts、MindNode、MindMapper、Scapple、CMAP、MindGenius 的专用解析，也没有 RTF、TextPack、MS Project XML 专用导出 | 按用户真实文件优先；TextPack 已能导入，另有表格复制与纯文本粘贴 |
| Apple 专属集成及语言覆盖 | 缺失。没有 Apple Pencil 专用行为、iPad 外接屏演示、Shortcuts 或 Marked 2 集成；目前提供简体中文与英语 | 等对应平台客户端立项后再补 |

已有的能力包括焦点和自动缩放、Markdown 富文本、主题编号、备注、关系线、边界、
摘要、条件格式、大纲、查找替换、演示、打印、常用格式导入导出及 `.itmz` 往返。
格式支持不意味着每个样式、元数据或跨平台交互都与原版一致。

对以学习和整理资料为主的用户，建议按 **闪卡 → 分支排序 → 加密文件设计** 推进；
平板侧单独验证笔迹输入和大图导航。保护文件前先明确恢复草稿、历史和云端副本的安全边界。

## English

The [official iThoughts feature table](https://www.toketaware.com/ithoughts-faq-features) and
[help index](https://www.toketaware.com/ithoughts-help) were compared with the iThread v0.7.1 code.
Focus and auto zoom are now covered. Major remaining gaps:

- **Study:** flashcard export, persistent multi-key sort rules, and shuffled branches.
- **Privacy:** password-protected native files and encrypted ITMZ import.
- **Content:** formula rendering, topic lookup, freehand drawing and sketch styling.
- **Workflow:** calendar/reminder and Things handoff, cost/effort rollups, and closer parity for
  partial automatic layout, filter syntax and opening matching branches.
- **Platforms:** provider-native cloud integrations, Apple-specific integrations, and more languages.
- **File exchange:** additional niche mind-map formats and dedicated RTF, TextPack and MS Project XML exports.

Existing equivalents include manual sorting, a task agenda, customizable layouts, advanced filters,
presentations, major interchange formats, and manual WebDAV sync. Recommended next steps are
flashcard export and better branch sorting, followed by a design for encrypted maps and their backups.

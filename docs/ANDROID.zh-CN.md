# 安卓平板版 · 开发预览

**简体中文 | [English](ANDROID.en.md)**

首版目标为 Android 10（API 29）及以上平板，需要 Android System WebView 124 或更高版本，
支持横竖屏、触摸与外接键盘。应用标识为
`com.ithread.android`，当前调试包为独立的 `com.ithread.android.preview`。
这不是已发布的稳定移动客户端，暂不替换 Windows v0.7.0 下载。

## 本阶段实现

- 独立 APK，随包提供现有编辑器和图片资源，离线启动、编辑和本地文件库。
- 复用 `.ithread`、`.itmz` 和 Markdown 等导入解析与导出，不引入第二套导图格式。
- 系统文件选择器导入；导出通过系统“创建文档”选择位置，不申请整个存储空间访问权。
- 手指拖动画布平移、双指缩放、双击主题编辑、长按主题打开操作菜单。鼠标端原有框选保留。
- 复用现有中英文设置与系统语言识别，以及已选定的 iThread 图标。
- 原生坚果云网络通道，复用 Windows 的协议 v2、历史版本和冲突判断；不需要 iThread 账号。

## 安全和数据边界

WebView 仅加载随 APK 提供的 HTTPS 本地资源。原生消息只接受指定来源的主框架、主文档；
不使用 `addJavascriptInterface` 或通用网址代理。外链交给外部应用，不在原生桥接页面打开。
应用不允许明文 HTTP，不忽略 TLS 错误，不请求广泛存储权限，不启用系统云备份。

同步仅支持 `dav.jianguoyun.com` 的专用目录和有限的 GET/PUT/PROPFIND；拒绝重定向。
凭据仅在内存中使用，关闭设置、应用进入后台、会话过期或销毁时关闭原生连接。
请使用自己的专用目录及应用密码，不要把凭据写入代码、导图、日志、GitHub 或 APK。

本预览的单次导入、导出及同步响应上限为 16 MiB（目录列表 2 MiB），一次最多导入 8 个文件。
坚果云共同的历史上限仍为每图 256 个版本 / 累计 128 MiB。冲突双方保留，无自动合并。
不同版本的限制不能通过忽略错误绕过；超限时请保留备份，不要手动删历史来强行恢复。

本地文件库位于应用私有的 WebView 存储。卸载应用或清除应用数据会删除未导出的本地内容；
同步不是唯一备份。当前没有原地回存系统文档、系统文件关联、后台自动同步、手写笔绘图或移动 CLI。
完整手势、软键盘、系统回收进程及 Windows↔安卓同步仍需模拟器和实机验证。

## 构建

需要 Node.js 22、pnpm 11、JDK 17、Gradle 8.13、Android SDK 36 与 Build Tools 35.0.0。
SDK 路径使用 `ANDROID_HOME` 或不提交的 `android/local.properties`（`sdk.dir=...`）。

```powershell
pnpm install --frozen-lockfile
pnpm android:prepare
gradle -p android testDebugUnitTest assembleDebug
```

输出：`android/app/build/outputs/apk/debug/app-debug.apk`。GitHub 的 Android preview 工作流
只上传调试包构建产物，不创建正式 Release，不修改 Windows 安装包。

调试包使用构建机的调试证书，不是正式分发签名。不同构建机的证书可能不同，不能保证覆盖
安装；如需重装，必须先导出本地导图，不能为了安装而直接卸载唯一副本。公开持续分发前需
建立并妥善备份稳定的安卓签名密钥；它与 Windows SignPath 证书是两件事。

## 依据

- [Android 本地资源加载](https://developer.android.com/develop/ui/views/layout/webapps/load-local-content)
- [受限来源的原生消息桥接](https://developer.android.com/develop/ui/views/layout/webapps/native-api-access-jsbridge)
- [AGP 8.13 构建要求](https://developer.android.com/build/releases/agp-8-13-0-release-notes)

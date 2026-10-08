# 代码签名政策

**简体中文 | [English](CODE_SIGNING_POLICY.md)**

## 服务方与当前状态

iThread 已申请 SignPath Foundation 开源代码签名计划。免费代码签名服务由
[SignPath.io](https://signpath.io/) 提供，证书由
[SignPath Foundation](https://signpath.org/) 提供。

申请目前仍在审核。签名流程批准并启用前，正式发布说明会标明 Windows 文件尚未签名，并公布
SHA-256 校验值。批准后，只会提交由本政策规定的公开发布工作流生成并审核的文件用于签名。

## 源代码与构建来源

- 源代码仓库：<https://github.com/KIDULTANK/iThread>
- 发布工作流：[`.github/workflows/desktop-release.yml`](.github/workflows/desktop-release.yml)
- 官方下载：<https://github.com/KIDULTANK/iThread/releases>
- 许可证：Apache License 2.0

发布文件必须由 GitHub Actions 根据公共仓库中带标签的提交构建。依赖从已经提交的锁文件安装，
工作流在打包 Windows 程序前运行项目的完整质量门禁，并保留未签名文件供后续签名。

## 角色

- 提交者与审查者：[KIDULTANK](https://github.com/KIDULTANK)
- 签名批准人：[KIDULTANK](https://github.com/KIDULTANK)

签名批准人必须核对源代码标签、工作流结果、文件名称、版本信息和预期 SHA-256 后才能批准签名。
本地修改过的二进制文件不得提交签名。

## 隐私与安全

iThread 的隐私承诺见[隐私政策](PRIVACY.zh-CN.md)。安全问题或发布文件完整性问题应通过仓库
[Issue 页面](https://github.com/KIDULTANK/iThread/issues)报告。被破坏或错误签名的发布文件将被
撤回、调查，并在适用时报告给 SignPath。

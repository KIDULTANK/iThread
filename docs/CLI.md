# iThread CLI

iThread 的本地 CLI 让脚本或智能体直接创建、读取和修改正在运行的导图。Windows 正式版和
开发预览都可使用；它只监听本机回环地址，不依赖互联网，也不会开放云端账户或内置 AI。

Windows 版每次启动会随机生成访问令牌，并把端口和令牌写入当前用户的发现文件。CLI 自动
读取该文件；令牌不会进入导图页面，其他网站也不能通过浏览器跨域调用控制桥。

## 启动

先打开 Windows 版 iThread，然后在项目目录检查连接：

```powershell
pnpm ithread status
pnpm ithread maps
```

未克隆源码时，可从同一 GitHub Release 下载 `ithread-cli.cmd` 与 `ithread-cli.mjs`，放在同一
文件夹后运行：

```powershell
.\ithread-cli.cmd status
.\ithread-cli.cmd maps
```

该轻量启动器需要电脑已安装 Node.js 18 或更高版本。安装包内部也附带这两个文件。

开发时也可以保持预览页面打开：

```powershell
pnpm dev --host 127.0.0.1 --port 4174
```

然后在另一个终端检查连接：

```powershell
pnpm ithread status
pnpm ithread maps
```

如果使用其他端口，在命令末尾加 `--url http://127.0.0.1:端口`。正式版无需填写端口。
`status` 会返回协议版本、连接方式和功能清单，便于智能体在操作前确认能力。

## 创建和读取

```powershell
pnpm ithread create --title "案件分析" --root "争议焦点"
pnpm ithread get --map 导图ID
```

`create` 默认会在 iThread 中打开新导图；加 `--no-open` 可只创建而不切换当前画布。所有命令返回 JSON，方便智能体读取导图 ID 和主题 ID，再继续操作。

## 导入本地文件

```powershell
pnpm ithread import --file "C:\Maps\example.itmz"
```

`import` 支持与应用“打开文件”相同的格式，默认把导入结果保存到本地图库并立即在当前画布打开。返回值包含导图 ID，以及主题、图片、折叠主题和浮动主题数量，便于智能体做真实格式验证。加 `--no-open` 可只导入而不切换画布；源文件不会被修改。

也可以把智能体生成的 Markdown 直接通过标准输入导入，不需要中间文件：

```powershell
Get-Content .\generated.md -Raw | pnpm ithread import --stdin --name generated.md
```

## 打开与导出

```powershell
pnpm ithread open --map 导图ID
pnpm ithread export --map 导图ID --file "C:\Maps\案件分析.ithread"
pnpm ithread export --map 导图ID --file "C:\Maps\案件分析.md"
```

`.ithread` 是完整原生备份，Markdown 是层级交换格式。导出目标由 CLI 明确指定，不允许页面
任意选择或扫描磁盘路径。

## 修改主题

```powershell
pnpm ithread add --map 导图ID --parent 父主题ID --topic "第一项证据"
pnpm ithread update --map 导图ID --node 主题ID --topic "已核验的证据"
pnpm ithread move --map 导图ID --node 主题ID --parent 新父主题ID --index 0
pnpm ithread delete --map 导图ID --node 主题ID --confirm
```

省略 `--map` 时操作当前打开的导图。`add` 可用 `--id 自定义ID` 创建稳定 ID，便于智能体在一组连续命令中引用刚生成的主题。`--index 0` 表示放到子主题列表首位。

删除必须显式提供 `--confirm`，中心主题不能删除或移动；将主题移入自己的下级分支也会被拒绝。对当前打开导图的修改会立即显示在画布上，并作为一次可撤销操作进入编辑历史。

## 批量原子修改

大量生成主题时不要逐条调用 `add`。把操作写入 JSON，一次提交：

```json
[
  { "action": "addTopic", "parentId": "root-id", "id": "facts", "topic": "案件事实" },
  { "action": "addTopic", "parentId": "facts", "id": "fact-1", "topic": "合同已签署" },
  { "action": "addTopic", "parentId": "root-id", "id": "law", "topic": "法律依据" }
]
```

```powershell
pnpm ithread batch --map 导图ID --file .\operations.json --dry-run
pnpm ithread batch --map 导图ID --file .\operations.json
```

`--dry-run` 只验证并返回预期结构，不保存。正式执行时所有操作只保存一次、只产生一次撤销记录；
任何一项失败，整批修改都不会写入。单批最多 10,000 项。

## 给智能体的调用约定

智能体可按下面的顺序工作：

1. 调用 `pnpm ithread status --compact`，确认 `appConnected` 为 `true`。
2. 调用 `maps` 或 `get` 取得现有结构和 ID。
3. 先拟定变更，再使用 `add`、`update`、`move`；删除只在用户明确要求时使用。
4. 大量新增使用 `batch --dry-run` 预检，再正式提交。
5. 最后再次调用 `get` 校验完整层级，必要时用 `export` 留存原生备份。

CLI 修改不会绕过 iThread 的结构校验；删除仍需显式确认。正式版使用随机端口和随机令牌，
开发预览则默认使用 `127.0.0.1:4174`，两者保持同一套命令协议。

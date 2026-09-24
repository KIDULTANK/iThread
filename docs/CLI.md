# iThread CLI

iThread 的本地 CLI 让脚本或智能体直接创建、读取和修改正在运行的导图。控制桥只在本机开发预览中启用，不依赖互联网，也不会开放云端账户。

## 启动

先保持 iThread 页面打开：

```powershell
pnpm dev --host 127.0.0.1 --port 4174
```

然后在另一个终端检查连接：

```powershell
pnpm ithread status
pnpm ithread maps
```

如果使用其他端口，在命令末尾加 `--url http://127.0.0.1:端口`。

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

## 修改主题

```powershell
pnpm ithread add --map 导图ID --parent 父主题ID --topic "第一项证据"
pnpm ithread update --map 导图ID --node 主题ID --topic "已核验的证据"
pnpm ithread move --map 导图ID --node 主题ID --parent 新父主题ID --index 0
pnpm ithread delete --map 导图ID --node 主题ID --confirm
```

省略 `--map` 时操作当前打开的导图。`add` 可用 `--id 自定义ID` 创建稳定 ID，便于智能体在一组连续命令中引用刚生成的主题。`--index 0` 表示放到子主题列表首位。

删除必须显式提供 `--confirm`，中心主题不能删除或移动；将主题移入自己的下级分支也会被拒绝。对当前打开导图的修改会立即显示在画布上，并作为一次可撤销操作进入编辑历史。

## 给智能体的调用约定

智能体可按下面的顺序工作：

1. 调用 `pnpm ithread status --compact`，确认 `appConnected` 为 `true`。
2. 调用 `maps` 或 `get` 取得现有结构和 ID。
3. 先拟定变更，再使用 `add`、`update`、`move`；删除只在用户明确要求时使用。
4. 最后再次调用 `get` 校验完整层级。

当前版本控制的是本机正在运行的 iThread 开发预览。以后封装 Windows 安装版时，可以把同一套命令协议放进本地原生宿主，保持 CLI 参数兼容。

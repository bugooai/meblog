# git-sync.ps1 —— Windows 侧「先试直连，网络类失败自动走 Clash 代理重试一次」，零残留。
#
# 用法（三选一）：
#   . .\scripts\git-sync.ps1                 # 点源引入，当前 PowerShell 会话得到 git-sync 函数
#   git-sync push origin dev                   # 之后把 git 换成 git-sync 就行，参数原样透传
#   或把本文件内容整段粘进 $PROFILE，长期生效
#
# 代理口：默认 http://127.0.0.1:7897（Clash 的 mixed 端口）。覆盖：
#   $env:GIT_SYNC_PROXY = 'http://127.0.0.1:7890'   # 设完要重新 dot-source 一次才生效
#
# 与容器侧 scripts/git-sync.sh 同语义（见 docs/RUN_LOCALLY.md 第 9 节）：
#   - 只有网络类失败才换路；认证失败 / 仓库不存在 / non-fast-forward 一律原样冒泡，不掩盖。
#   - 不写任何 git config，用完零残留；撤销方法就是不再调用本函数。
#   - api.github.com 永远钉死直连（走代理会被按出口 IP 随机拒 403）。
#   - GIT_TERMINAL_PROMPT=0 只在函数运行期间生效，退出时复原，不留环境变量。
$GitSyncProxy = if ($env:GIT_SYNC_PROXY) { $env:GIT_SYNC_PROXY } else { 'http://127.0.0.1:7897' }

function git-sync {
  param([Parameter(ValueFromRemainingArguments = $true)]$GitArgs)
  $guard = @('-c', 'http.https://api.github.com.proxy=')
  $proxy = @('-c', 'http.https://github.com/.proxy=http://127.0.0.1:7897')
  $netpat = 'Failed to connect|Could not resolve host|Connection refused|timed out|Connection reset|Empty reply|encountered end of file|Recv failure|Send failure|remote end hung up|SSL_read|unable to access|returned error: 5\d\d'
  $log = [System.IO.Path]::GetTempFileName()
  $savedPrompt = $env:GIT_TERMINAL_PROMPT
  $env:GIT_TERMINAL_PROMPT = '0'      # 不弹凭据框挂住，否则永远走不到重试那步
  try {
    & git @guard @GitArgs 2>$log              # 第 1 步：直连
    if ($LASTEXITCODE -eq 0) { return }
    $err = Get-Content -Raw -ErrorAction SilentlyContinue $log
    if ($err -notmatch $netpat) {             # 非网络错误：原样冒泡，不重试不掩盖
      Write-Host "[git-sync] 直连失败且不是网络类错误，不试代理（rc=$LASTEXITCODE）"
      if ($err) { Write-Host $err }
      return
    }
    Write-Host '[git-sync] 直连网络类失败，改用 Clash 代理重试一次（api.github.com 仍强制直连）'
    & git @guard @proxy @GitArgs 2>$log
    $err2 = Get-Content -Raw -ErrorAction SilentlyContinue $log
    if ($err2) { Write-Host $err2 }
  } finally {
    Remove-Item $log -ErrorAction SilentlyContinue
    if ($null -ne $savedPrompt) { $env:GIT_TERMINAL_PROMPT = $savedPrompt }
    else { Remove-Item 'Env:GIT_TERMINAL_PROMPT' -ErrorAction SilentlyContinue }
  }
}

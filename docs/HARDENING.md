# 线上暴露面收口核对（116.62.176.216 / meblog.bugooai.cn）

2026-10-15 17:26–17:27 UTC 从容器外对线上做的真实探测，全部原样贴输出，不是推测。
每条修法都配「怎么验」和「怎么撤」，改一处验一处。

**这台机同时跑生产博客和历史上写进源码的测试库，动手前先确认没有外部消费者。**

## 一、当前状态（改前基线，2026-10-15 17:26:45Z）

TCP（`python3` connect，6 秒超时；`filtered` = 有防火墙丢包，`refused` = 端口通但没人在听）：

```
116.62.176.216:22     OPEN                         24 ms
116.62.176.216:80     OPEN                         29 ms
116.62.176.216:443    ConnectionRefusedError       2149 ms
116.62.176.216:8000   OPEN                         29 ms
116.62.176.216:8001   OPEN                         22 ms
116.62.176.216:8200   OPEN                         22 ms
116.62.176.216:9000   TimeoutError: timed out      6006 ms
116.62.176.216:9001   TimeoutError: timed out      6006 ms
```

应用层（17:27:32Z）：

| 目标 | 结果 | 含义 |
|---|---|---|
| `http://116.62.176.216:8000/docs` | `HTTP 200`，`server: uvicorn`，945 B | **测试环境后端的 Swagger 在公网上** |
| `http://116.62.176.216:8001/` | `HTTP 200`，`x-powered-by: Next.js`，61 494 B | **测试环境前端整站在公网上** |
| `http://116.62.176.216:9000` / `:9001` | 6 秒超时（filtered） | 生产侧被安全组挡住，这是对的口径 |
| `116.62.176.216:8200` 协议握手 | 回包 `b'N'` | **公网可达的 PostgreSQL 15，且在拒绝 SSL（口令明文过网）**。只发了 SSLRequest 判活，没做任何认证尝试 |
| `meblog.bugooai.cn` | → `116.62.176.216`；`HTTP 200`，`server: nginx/1.18.0 (Ubuntu)` | 80 公网可达 ⇒ HTTP-01 能签 |
| `https://meblog.bugooai.cn/` | `curl` exit `7`（连接被拒） | **没有 https**，登录口令在公网明文传 |

`ufw` 在这台机上是 `inactive`，所以以上「能不能连上」完全取决于阿里云安全组 —— 也就是说：
**关端口有两处可关（安全组 / 容器绑定），只关一处都会在下次改配置时漏回来。**

## 二、逐条修法、验法、撤法

### 1）Postgres 挂在公网 `0.0.0.0:8200` —— 最高优先级

`common-postgres`（postgres:15-alpine）映射 `0.0.0.0:8200->5432`，库里有 `meblog`（生产）和 `meblog_test`。
这个 compose **不在本仓库**（是服务器上共享的 `common-*` 栈），所以这里只给最小改动，不动它。

先确认没有外部消费者（有输出才算数，别看代码猜）：

```bash
ss -tnp state established '( dport = :8200 or sport = :8200 )'   # 现在谁在连
docker exec common-postgres psql -U postgres -d postgres -c \
  "select client_addr, count(*) from pg_stat_activity where client_addr is not null group by 1;"
```

- 两条输出里**只有** `172.17.x.x` / `127.0.0.1` / docker 网段 ⇒ 没有外部消费者，可以收口。
- 出现公网 client_addr ⇒ 先找到那个消费者，别直接关。

收口（选一种，改前先 `docker compose -f <那个 compose 文件> config > /tmp/pg-compose.bak`）：

| 方案 | 改动 | 影响 |
|---|---|---|
| A 快 | compose 里 `8200:5432` → `127.0.0.1:8200:5432` | 主机上的 `psql`/隧道照常，公网立刻关不掉也连不上 |
| B 干净 | 直接删掉 `ports:` 段，只留 `common-network` | 容器间照常；主机调试要 `docker exec` |

验：`ss -tlnp \| grep 8200` 期望 `127.0.0.1:8200`；再从容器外跑上面那张 TCP 表，期望 `8200` 变 refused/filtered。
撤：还原 compose 后 `docker compose -f <文件> up -d common-postgres`。
**两处都要关**：安全组入方向同时删掉 8200 放行 —— 单靠 compose 改绑定，别人换台机重新 `up` 又开了。

### 2）测试环境的 8000（Swagger）/ 8001（前端）在公网

生产侧靠安全组挡是对的口径，测试侧照同样两条关：

- 安全组：入方向删掉 `8000/tcp`、`8001/tcp` 的 `0.0.0.0/0` 放行。
- 仓库侧（下次部署生效，防回漏）：`docker-compose-backend-test.yml` 的 `"8000:8000"` → `"127.0.0.1:8000:8000"`；`docker-compose-frontend-test.yml` 的 `"8001:3000"` → `"127.0.0.1:8001:3000"`。

代价说清楚：绑到 `127.0.0.1` 之后，测试站只能从服务器本机或 SSH 隧道看：
`ssh -N -L 18001:127.0.0.1:8001 -L 18000:127.0.0.1:8000 <部署账号>@116.62.176.216`，浏览器开 `http://127.0.0.1:18001`。
生产侧（9000/9001）**不建议**跟着改绑定：nginx 的 upstream 具体指向什么地址还没核（见第一节末尾），万一它是走 docker 网桥而不是 `127.0.0.1`，改完站点直接 502。生产侧只关安全组，实测已经是 filtered。

验（改前基线已在第一节）：`curl -o /dev/null -w '%{http_code}\n' http://116.62.176.216:8000/docs` 期望非 200；
撤：删掉 `127.0.0.1:` 前缀重新 `up -d`，或在安全组把 8000/8001 放行加回来。

### 3）https 没配

目标状态参考：`deploy/nginx/meblog.bugooai.cn.conf`。

装 + 签 + 自动改配置 + 自动续期（一次装好，全程不需要密码）：`apt-get install -y certbot python3-certbot-nginx`，
然后 `certbot --nginx -d meblog.bugooai.cn --redirect`。

顺序坑：**80→443 跳转必须在证书签成功之后打开**，HTTP-01 验证走的就是 80，先跳了签不下来。
签完还要把 `SITE_URL` / `NEXT_PUBLIC_SITE_URL` 从 `http://` 改 `https://`（`docs/DEPLOY.md` 那两处 env），
否则 canonical / sitemap / og 还是 http，跳过去又自我降级。

验：

```bash
nginx -t
curl -sI https://meblog.bugooai.cn/ | head -1                       # 期望 HTTP/1.1 200
echo | openssl s_client -connect meblog.bugooai.cn:443 -servername meblog.bugooai.cn 2>/dev/null \
  | openssl x509 -noout -issuer -dates                             # 期望 issuer = Let's Encrypt，notAfter ≈ 90 天后
curl -sI http://meblog.bugooai.cn/ | head -1                        # 期望 301
certbot certificates                                               # 确认自动续期在 systemd timer 里
```

撤：`certbot revoke --cert-name meblog.bugooai.cn`（或干脆不管，证书不续 90 天自己失效），
nginx 配置回滚用 certbot 自动留下的 `/etc/nginx/sites-available/*.bak-*`，`nginx -s reload`。

### 4）root 口令已泄露 + SSH 允许 root 密码登录

口令出现在工单正文和运行日志里，工单历史不可清 —— 按已泄露处理，**必须轮换**，且只能由布谷本人做。
顺手一起改掉：`PermitRootLogin prohibit-password`（或 `no`）+ `PasswordAuthentication no`，
改用专用部署账号 + SSH key。阿里云控制台可以「重置实例密码」（要重启生效），也可以直接给实例绑一对密钥，后者更快。

验：`ssh -o PreferredAuthentications=password -o PubkeyAuthentication=no root@116.62.176.216` 期望被拒；
旧口令登录失败、新 key 登录成功；`sshd -T \| grep -E 'permitrootlogin\|passwordauthentication'` 输出与预期一致。
撤：`/etc/ssh/sshd_config.d/` 里把改掉的行删掉再 `systemctl reload ssh`（**别在不确定有第二条可用通道时关掉密码登录**，这台机只有 22 一个入口，把自己锁在外面就没法收口了）。

### 5）服务器上 git remote 嵌着明文凭据

`/root/code/projects/meblog/.git/config` 的 `origin` 形如 `https://<user>:<token>@gitee.com/...`。
口令/token 落在明文文件里，`ls -l` 谁能读这台机的文件谁能拿。
改成不带凭据的地址（本次部署就是从 github 拉的，那份 gitee 凭据根本没被用到），凭据交给 helper：

```bash
git remote set-url origin https://github.com/bugooai/meblog.git
git config credential.helper 'cache --timeout=600'      # 或 store 到 0600 的 ~/.git-credentials
git ls-remote origin HEAD                               # 拉得到才算换成功
```

验：`git config --get remote.origin.url` 输出里不带 `:`/`@` 凭据段。
撤：`git remote set-url origin <原来那个地址>`。

## 三、这份文件本身改了什么

只新增文档和一份没接线的 nginx 参考配置，**没动任何 compose、没动线上、没动 main**：

- 新增 `docs/HARDENING.md`（本文件）
- 新增 `deploy/nginx/meblog.bugooai.cn.conf`（目标状态参考，`nginx -t` 得在服务器上说，本地没有 nginx 二进制；已核对括号配平、`return 301` 保持注释状态以免签证书时被自己跳死）
- `deploy.sh.example` 不再用 `sshpass` 传密码、不再全局开/关代理、不再把公网测试端口当部署成功的标志打印

回滚整个改动：`git revert <这个 commit>`。线上服务的生效条件是有人按上面的步骤部署，本次运行一个都没部署。

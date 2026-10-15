# 线上暴露面收口核对（116.62.176.216 / meblog.bugooai.cn）

2026-10-15 17:26–17:27 UTC 从容器外对线上做的真实探测，第一节全部原样贴输出。
每条修法都配「怎么验」和「怎么撤」，改一处验一处。

**实测和推断必须分开看。** 网管没有这台机的 SSH 通道，所以下面这些**一条都不是外部探测能证明的**：容器名和镜像、compose 里的端口映射、库名和 PostgreSQL 版本、`ufw` 状态、线上 nginx 现有配置、服务器上 `.git/config` 的内容。凡是推断的地方都标了「推断」，并配一条在机器上跑的只读确认命令。**确认之前不要照抄任何一步。**

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

两条读数说明：

- **443 是 `refused`，不是 timeout** —— 包到了机器上被拒（对比 9000/9001 的 timeout，那两个是安全组在丢包）。所以 443 大概率**没被安全组挡**，证书签下来就能对外服务，不用再加放行规则。**推断**，动手前从外面复测一次。
- **6001 没测** —— `docs/PRD.md:819` 写这台机的 PostgreSQL 跑在 6001，`docs/DEPLOY.md:179` 那条泄露地址也是 `...:6001/meblog_test`。基线表里没有它。**动手前补一次探测**：`timeout 6 python3 -c "import socket;socket.create_connection(('116.62.176.216',6001),6)" && echo OPEN`，通了就是第二个要收的口子。

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

**外面只证明了两件事**：8200 公网可连，且它对 8 字节 SSLRequest 回了 `N`（= PostgreSQL，不接受加密）。
下面这句是**推断**，机器外面拿不到这些信息：容器叫 `common-postgres`、镜像是 postgres:15-alpine、映射是 `0.0.0.0:8200->5432`、库里有 `meblog`（生产）和 `meblog_test`。
这个 compose **不在本仓库**（是服务器上共享的 `common-*` 栈），所以这里只给最小改动，不动它。

先把推断变成事实（在机器上跑，全部只读）：

```bash
docker ps --filter publish=8200 --format '{{.Names}}  {{.Image}}  {{.Ports}}'   # 8200 到底是哪个容器在听
docker inspect common-postgres --format '{{index .Config.Labels "com.docker.compose.project.config_files"}}'   # compose 文件的真实路径，后面备份/撤销都用它，别猜
docker inspect common-postgres --format '{{json .Mounts}}'   # 数据目录在不在命名卷/宿主目录上；不在就别重建容器
```

再确认没有外部消费者（有输出才算数，别看代码猜）：

```bash
ss -tnp state established '( dport = :8200 or sport = :8200 )'   # 现在谁在连
docker exec common-postgres psql -U postgres -d postgres -c \
  "select client_addr, count(*) from pg_stat_activity where client_addr is not null group by 1;"
```

- 两条输出里**只有** `172.17.x.x` / `127.0.0.1` / docker 网段 ⇒ 没有**常驻**的外部连接。
- 出现公网 client_addr ⇒ 先找到那个消费者，别直接关。
- `psql -U postgres` 失败并不意外：历史上进过源码的那条连接串用的是 `admin:admin@common-postgres:5432`（`git show ec2af0b:backend/.env.test`），这个栈很可能把超级用户改过名字。报 `role "postgres" does not exist` 就换成 `docker inspect common-postgres --format '{{json .Config.Env}}'` 里的 `POSTGRES_USER`。
- **这两条只能证明「此刻没有常驻连接」，不能证明「没有外部消费者」**：连完就断的定时任务、几周才跑一次的脚本、别人手里的工具都会溜过去。要硬证据就看历史日志：

```bash
docker exec common-postgres psql -U postgres -c 'show log_connections;'
docker logs --since 168h common-postgres 2>&1 | grep -oE 'connection received: host=[0-9.]+' | sort | uniq -c | sort -rn
```

`log_connections` 默认关，输出为 `off` 时第二条必定是空的（**空输出不等于没有人用**）。

**推荐顺序和「先改绑定」相反**：先只删安全组的 8200 放行。它在控制台点两下，**秒级可撤、不重建任何容器、不用先证明没有外部消费者**；观察几天没人喊连不上，再按下面的 A/B 改绑定断根。
A/B 都要 `docker compose up -d` 重建这个容器 = 连着它的所有服务一起断几秒，前面那条 `.Mounts` 确认没过就别动。

收口（选一种，改前先 `docker compose -f <上面 inspect 出来的路径> config > /tmp/pg-compose.bak`）：

| 方案 | 改动 | 影响 |
|---|---|---|
| A 快 | compose 里 `8200:5432` → `127.0.0.1:8200:5432` | 主机上的 `psql`/隧道照常；即使安全组那条还没删掉，公网也连不上（只绑在了回环上） |
| B 干净 | 直接删掉 `ports:` 段，只留 `common-network` | 容器间照常；主机调试要 `docker exec` |

验：`ss -tlnp \| grep 8200` 期望 `127.0.0.1:8200`；再从容器外跑上面那张 TCP 表，期望 `8200` 变 refused/filtered。
撤：还原 compose 后 `docker compose -f <文件> up -d common-postgres`。
**两处都要关**：安全组入方向同时删掉 8200 放行 —— 单靠 compose 改绑定，别人换台机重新 `up` 又开了。

### 2）测试环境的 8000（Swagger）/ 8001（前端）在公网

生产侧靠安全组挡是对的口径，测试侧照同样两条关：

- 安全组：入方向删掉 `8000/tcp`、`8001/tcp` 的 `0.0.0.0/0` 放行。
- 仓库侧（下次部署生效，防回漏）：`docker-compose-backend-test.yml` 的 `"8000:8000"` → `"127.0.0.1:8000:8000"`（该文件 `ports:` 那行）；`docker-compose-frontend-test.yml` 的 `"8001:3000"` → `"127.0.0.1:8001:3000"`（同上）。两处字面值和仓库现状一致，改完不冲突。

**容器间调用不会被误伤**：`ports:` 只管宿主机的对外映射，容器之间走的是 `common-network` 上的容器名 + 容器内部端口，改绑定动不到它。仓库里三条容器间路径都是这样：

| 路径 | 用的地址 | 依据 |
|---|---|---|
| 前端 SSR 取数（test） | `http://meblog-backend:8000/api/v1` | `frontend/app/lib/server-api.ts:2` + `docker-compose-backend-test.yml:28` 的网络别名 |
| 前端 SSR 取数（prod） | 容器名 + `:8000` | `docker-compose-frontend-production.yml` 的 `SERVER_API_BASE_URL` 默认值 |
| 后端通知前端 revalidate | 容器名 + `:3000` | `backend/.env.production.example` 的 `FRONTEND_REVALIDATE_URL`，原因见 `docs/DEPLOY.md:90-106` |

**但有两个前提要先在机器上核**，否则这一条会从「不误伤」变成「误伤」：

```bash
docker ps --format '{{.Names}}  {{.Ports}}'                                  # 容器名的拼写要以线上为准
docker exec <后端容器> sh -c 'grep -H "FRONTEND_REVALIDATE_URL" /app/.env.* 2>/dev/null'
```

- 如果测试环境的 `FRONTEND_REVALIDATE_URL` 填的是 `http://127.0.0.1:8001/...` 或宿主 IP:8001 这种**穿宿主机映射**的地址就麻烦了：在后端容器里 `127.0.0.1` 指的是这个容器自己，所以它本来就不通，只是没人报错 —— 发不出去只打一行 warning（`backend/app/utils/revalidate.py:52`），首页最长 180 秒才更新，看起来像「缓存没刷」而不像故障。**先把地址改成容器名，再改绑定。**
- 容器名的拼写在仓库里摇摆过：`8018d22` 时 `image:` 写 `meblog-*`、`container_name:` 写 `memblog-*`（多一个 m），到 `5cc24e6` 才统一。**以线上为准，别以文件为准**：`docker ps --format '{{.Names}}  {{.Ports}}'` 是唯一可信的名单。改 `container_name` 等于重建容器 + 换 DNS 名，而服务器上 `backend/.env.production` 里写死的那个名字不会跟着变 —— revalidate 从此静默失效（首页最长 180 秒才更新），日志里只有一行 warning。**下次 `up -d` 之前先把两边的名字对一遍。**

代价说清楚：绑到 `127.0.0.1` 之后，测试站只能从服务器本机或 SSH 隧道看：
`ssh -N -L 18001:127.0.0.1:8001 -L 18000:127.0.0.1:8000 <部署账号>@116.62.176.216`，浏览器开 `http://127.0.0.1:18001`。
生产侧（9000/9001）**不建议**跟着改绑定：nginx 的 upstream 具体指向什么地址还没核（对照说明在 `deploy/nginx/meblog.bugooai.cn.conf` 文件头），万一它是走 docker 网桥而不是 `127.0.0.1`，改完站点直接 502。生产侧只关安全组，实测已经是 filtered。

验（改前基线已在第一节）：`curl -o /dev/null -w '%{http_code}\n' http://116.62.176.216:8000/docs` 期望非 200；
撤：删掉 `127.0.0.1:` 前缀重新 `up -d`，或在安全组把 8000/8001 放行加回来。

### 3）https 没配

目标状态参考：`deploy/nginx/meblog.bugooai.cn.conf`。

先在机器上把「线上 nginx 现在长什么样」看清楚（这份文件头里的现状描述是推断，外部探测看不到 nginx 配置）：

```bash
certbot certificates                                # 有没有证书、有没有装过 certbot
ls /etc/letsencrypt/live/ 2>/dev/null               # 报 No such file = 从没签过
nginx -T 2>/dev/null | grep -E 'listen|server_name|proxy_pass'   # 现有 upstream 到底指向哪个地址:端口
```

**别把 `deploy/nginx/meblog.bugooai.cn.conf` 整份丢进 `sites-enabled/` 再 reload**：它的 443 段是活代码，证书不存在时 `nginx -t` 会卡在 `cannot load certificate ... No such file or directory`，reload 直接失败（老配置还在跑，但你会以为已经改好了）。要走手工那条路，就先只放 80 那一段。

装 + 签 + 自动改配置 + 自动续期（一次装好，全程不需要密码）：`apt-get install -y certbot python3-certbot-nginx`，
然后 `certbot --nginx -d meblog.bugooai.cn --redirect`。手工那条路（`--webroot`）还要先 `mkdir -p /var/www/certbot`，
参考配置里 `/.well-known/acme-challenge/` 的 root 指的就是它，目录不存在验证会 404。

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

**顺序必须是：先在控制台绑密钥 → 另开一个终端用密钥登进去一次 → 确认能进 → 才关密码登录。** 这台机只有 22 一个入口，顺序反了就是把自己锁在外面，收口动作全部停摆。
关完之后 `deploy.sh.example` 那条 `ssh -o BatchMode=yes` 才有得跑：BatchMode 意味着脚本永远不退回口令输入，密钥没装好就是直接失败（这是好事，但要知道它在说什么）。

验：`ssh -o PreferredAuthentications=password -o PubkeyAuthentication=no root@116.62.176.216` 期望被拒；
旧口令登录失败、新 key 登录成功；`sshd -T \| grep -E 'permitrootlogin\|passwordauthentication'` 输出与预期一致。
撤：`/etc/ssh/sshd_config.d/` 里把改掉的行删掉再 `systemctl reload ssh`（**别在不确定有第二条可用通道时关掉密码登录**，这台机只有 22 一个入口，把自己锁在外面就没法收口了）。

### 5）服务器上 git remote 嵌着明文凭据

**推断**（外部探测看不到服务器上的文件）：`/root/code/projects/meblog/.git/config` 的 `origin` 形如 `https://<user>:<token>@gitee.com/...`。依据是仓库里被删掉的旧部署模板一直用 `git clone https://gitee.com/AhernLi-ai/meblog.git`（`git show 8018d22^:deploy.sh.example`）和 `git push gitee dev`，那条路径确实指向 gitee。先在机器上确认：

```bash
git -C /root/code/projects/meblog config --get remote.origin.url
```

口令/token 落在明文文件里，谁能读这台机的文件谁就能拿。
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

## 四、CMP-6 review 改了哪几处（2026-10-15，得得）

Review 的是 `8018d22` 这份材料本身。**没有执行任何一条线上动作**，改的都是口径：

1. 把「实测」和「推断」分开标注，每条推断配一条在机器上跑的只读确认命令（原来的写法会让人以为容器名、端口映射、`ufw` 状态、nginx 现状都已经被证实）。
2. 补上基线漏掉的 `6001`，并写明 443 是 `refused` 而不是 timeout 该怎么读。
3. 第 1 节：`psql -U postgres` 的角色名风险、`ss` 单次快照证明不了「没有外部消费者」、compose 文件路径和 `.Mounts` 要先查、A/B 都会重建容器 = 数据库断几秒；推荐顺序改成**先删安全组（秒级可撤、不动容器），观察几天再改绑定**。
4. 第 2 节：写清改绑定不会误伤容器间调用（含三条路径的代码依据），但要求先在机器上核 `FRONTEND_REVALIDATE_URL` 的写法与容器名拼写。
5. 第 3 节 / nginx 参考配置：443 段是活代码，证书不存在时整份拷贝会让 `nginx -t` 直接失败；`Connection` 头改成按 `$http_upgrade` 取值（写死 `upgrade` 会让上游 keepalive 失效）；补 `server_tokens off` 和 `--webroot` 需要的 `/var/www/certbot`。
6. `deploy.sh.example`：生产改成跟 `main`、测试跟 `dev`（原来两边都 pull `dev`，等于生产能跑没发版的代码）；健康检查按环境打宿主机端口（原来写死 8000，生产部署时探的是测试环境的后端）；`git reset --hard HEAD && git pull` 换成 `fetch` + `reset --hard origin/<分支>`；补上「密钥先能用，再关密码登录」的顺序和 `PROJECT_ROOT` 与部署账号的冲突。本地用 `bash -n` 验证过整个脚本和 ssh 远端那段拼出来的命令。

回滚：`git revert 8018d22` 撤掉材料本体，再 `git revert <本节这个 commit>` 撤掉上面的口径修订。
线上服务的生效条件是有人按上面的步骤部署 —— 到 review 为止，一条都没部署过。

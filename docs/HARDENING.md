# 线上暴露面收口核对（116.62.176.216 / meblog.bugooai.cn）

2026-10-15 从容器外（17:26–17:27 UTC 首测、18:18–18:20 UTC 在**线上切到 `dev@5cc24e6` 之后**复测）+ 机器上只读（17:0x 盘点、17:59 UTC 复量）两个方向量过的那台机，本文全部原样贴输出。
每条修法都配「怎么验」和「怎么撤」，改一处验一处。

**实测和推断必须分开看**，但要分对是哪一类。这台机的数据有三种来源，别混：

| 来源 | 能证明什么 | 本文里的标记 |
|---|---|---|
| 容器外探测（网管，17:26–17:27 / 18:18–18:20 UTC） | 端口开不开、HTTP 码、TLS 有没有、PostgreSQL 协议是否应答 | 第一节基线表 |
| **机器上只读登录**（网管，17:0x–17:1x 盘点 + 17:59 UTC 复量，见 [CMP-4](/cmp/issues/CMP-4)） | 容器名/镜像/端口映射、库名、`ufw` 状态、nginx 现有配置、`.git/config` 内容 | 第五节，带时间戳 |
| 仓库里的字面值 | compose 应该长什么样 —— **不等于线上正在跑什么** | 各处「以线上为准」 |

第五节把原来标成「推断」的那批条目升级成了机器上的实测，`3639b86` 给每条配的只读复认命令**全部保留**：那条 SSH 通道用的是已经泄露的 root 口令，口令一轮换这条通道就没了，所以这些值是**带时间戳的快照，不是永久事实**。动之前按复认命令再跑一遍。

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

- **443 是 `refused`，不是 timeout** —— 包到了机器上被拒（对比 9000/9001 的 timeout，那两个是安全组在丢包）。所以 443 **没有被安全组挡**，证书签下来就能对外服务，不用加放行规则。这条现在有机器上的量值背书：`ss -ltn | grep -c ":443"` → **0**（第五节），是没人监听，不是被挡。
- **6001 已补测（2026-10-15 18:20:38Z）** —— `docs/PRD.md:819` 写这台机的 PostgreSQL 跑在 6001，`docs/DEPLOY.md:179` 那条泄露地址也是 `...:6001/meblog_test`。实测：

  ```
  116.62.176.216:6001  ConnectionRefusedError  2137 ms     ← 没人监听，但安全组没挡
  116.62.176.216:6379  TimeoutError: timed out 6005 ms     ← Redis 默认端口，安全组在丢包
  ```

  结论：**6001 不是第二个已经在漏的口子**，但它和 443 一样「安全组放行 + 本机无人监听」，意味着以后任何人在这台机上绑一个 6001（或任何非 80/22 端口）都会**直接公网可见**。收口时建议在安全组里把 80/22/443 之外的入方向放行逐条过一遍，别只删 8200/8000/8001 三条了事。只测了文档点名的这两个端口，没有做端口扫描。

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
容器叫 `common-postgres`、镜像是 `postgres:15-alpine`、映射是 `0.0.0.0:8200->5432`、库里有 `meblog`（生产，owner `admin`）和 `meblog_test`（owner `test`）—— 这四条是 2026-10-15 17:0x UTC 在机器上读到的（第五节），**不是推断**，但它是换构建之前的快照，`docker inspect` 复认只要十秒，动之前必跑。
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
- **超级用户就是 `postgres`**（2026-10-16 18:44 UTC 网管在机器上实测：`docker inspect common-postgres` 的 `POSTGRES_USER=postgres`，`pg_roles` 里 `rolsuper=t` 只有它一个，`admin` / `root` / `test` 都是 `f`）。本文件原来写的是「`psql -U postgres` 会报 `role "postgres" does not exist`，因为超级用户可能改过名字」—— **那条前提已经不成立**，它是换构建之前的快照；口径来源是网管那轮的真实输出，得得没有自己复测（够不到那台机）。
- **口径不变**：动手前先 `docker inspect common-postgres --format '{{json .Config.Env}}'` 取 `POSTGRES_USER`，别照着记忆写。容器重建过一次，角色就可能整个换名 —— 这条比「上次是哪个名字」有用。
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
- 容器名从来没换过，换过的是引用。四个 compose 文件里的 `container_name` 从 `2f34820` 到 `e922dd5` 一直是 `meblog-backend-prod` / `meblog-frontend-prod` / `meblog-backend-test` / `meblog-frontend-test`（复认命令见第八节）。`5cc24e6` 修的是**引用侧少一个 m**：compose 的 `SERVER_API_BASE_URL` 默认值、`.env.example` 注释、两份 `FRONTEND_REVALIDATE_URL` 模板、`frontend/.env.production.example` 两行、`docs/DEPLOY.md`、nginx 模板的 `proxy_pass`，加 `backend/migrate.sh` 与 `docs/PRD.md` 的示例库名，共 15 处（`git show --stat 5cc24e6`）。**以线上为准，别以文件为准**这条习惯仍然成立，但理由是另一头：服务器上那份手写的 `backend/.env.production` 不在 git 里，`git pull` 到 `5cc24e6` 也改不到它，而它当年照的是旧模板，里面很可能仍写着 `memblog-frontend-prod`。上面那条 `docker exec` 一跑就能确认 —— 是错的就改字，然后 `docker compose up -d` 重建（env 在容器创建时读进去，只改文件不重建等于没改），revalidate 才真的通；不改就一直静默失效：日志里只有一行 warning（`backend/app/utils/revalidate.py:52`），首页最长 180 秒才更新，看起来像「缓存没刷」而不像故障。**下次 `up -d` 之前把 `.env` 里的名字和 `docker ps` 的名单对一遍。**

代价说清楚：绑到 `127.0.0.1` 之后，测试站只能从服务器本机或 SSH 隧道看：
`ssh -N -L 18001:127.0.0.1:8001 -L 18000:127.0.0.1:8000 <部署账号>@116.62.176.216`，浏览器开 `http://127.0.0.1:18001`。
生产侧（9000/9001）**建议只关安全组，不改绑定**。不是「不敢改」，是量过之后判断收益不值：线上 nginx 实测转的是 `proxy_pass http://localhost:9001`（站点/`/admin`）和 `http://localhost:9000`（`/api`），`nginx -T` 里 **0 个 `upstream` 块**（第五节）—— 也就是说绑 `127.0.0.1` 在方向上确实能对上，但 `localhost` 是**名字**不是地址：docker 的 `127.0.0.1:9001:` 绑定只建 IPv4 监听，而 Ubuntu 的 `/etc/hosts` 里 `localhost` 同时挂 `127.0.0.1` 和 `::1`，解析顺序一变就 502。所以真要改，**必须同一次把 nginx 里那三行写死成 `127.0.0.1:9001` / `127.0.0.1:9000` 再 `nginx -t && reload`**，两步拆开做就是给自己埋 502。生产侧实测本来就是 filtered，公网进不去；这一刀的收益要等 https 那次一并动 nginx 时才划算，别单独排期。

验（改前基线已在第一节）：`curl -o /dev/null -w '%{http_code}\n' http://116.62.176.216:8000/docs` 期望非 200；
撤：删掉 `127.0.0.1:` 前缀重新 `up -d`，或在安全组把 8000/8001 放行加回来。

### 3）https 没配

目标状态参考：`deploy/nginx/meblog.bugooai.cn.conf`。

线上 nginx 现状**已经量过了**（第五节，17:59 UTC 只读登录），下面这三条留着是为了复认 —— 状态会漂，动手前再跑一次：

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

## 五、机器上只读实测快照（2026-10-15 17:59 UTC，网管）

来源：CMP-4 期间布谷给的通道（口令 + askpass，口令不进 argv/日志），**全程只读**，唯一写入是部署和那次 2G 临时 swap（已 `swapoff`）。这一节把 `3639b86` 标成「推断」的几条升级成实测；口令轮换后这条通道会失效，所以下面每一项都带复认命令。

| 项 | 机器上量到的值 | 复认命令 |
|---|---|---|
| `certbot` | **未安装**（`command -v certbot` 空） | `command -v certbot` |
| nginx 版本 / 自检 | `nginx/1.18.0 (Ubuntu)`；`nginx -t` = syntax ok / test successful | `nginx -v; nginx -t` |
| 443 监听 | `ss -ltn \| grep -c ":443"` → **0** | 同左 |
| `/etc/letsencrypt` | **No such file or directory**（从没签过） | `ls /etc/letsencrypt/live/` |
| `sites-enabled/` | `default`、`meblog-test.bugooai.cn.conf`、`meblog.bugooai.cn.conf`（`conf.d/` 空） | `ls -l /etc/nginx/sites-enabled/` |
| `default` 里那两行 | `27:# listen 443 ssl default_server;`、`28:# listen [::]:443 ssl default_server;` —— 注释状态，且在 **default** server 里，不在 meblog 那组 | `grep -n 'listen 443' /etc/nginx/sites-enabled/default` |
| meblog 的 server block | `listen 80` + `server_name meblog.bugooai.cn`；`location / → proxy_pass http://localhost:9001`；`location /admin → http://localhost:9001/admin`；`location /api → http://localhost:9000`；另有一条 `location = /baidu_verify_codeva-*.html` | `nginx -T \| sed -n '/server_name meblog/,/}/p'` |
| `upstream` 定义 | **0 个** —— 线上没用 upstream 块，走的是宿主机回环上的 compose 发布端口 | `nginx -T \| grep -c 'upstream '` |
| `ufw` | `inactive`（所以公网可达性只取决于阿里云安全组） | `ufw status` |
| 服务器上的 `.git/config` | `origin` 形如 `https://<user>:<token>@gitee.com/...`，明文凭据嵌在 URL 里 | `grep -n url /root/code/projects/meblog/.git/config` |
| 机器规格 | Ubuntu 22.04，2 核 / 3.4G，up 176 天 | `uptime; free -h` |

**这份快照对第 2、3 节的直接影响**：

1. 第 3 节里 `deploy/nginx/meblog.bugooai.cn.conf` 那两行 `upstream meblog_*_prod { server 127.0.0.1:900x; }` 是**目标形态不是现状** —— 照抄等于把「按名字转 localhost」换成「走显式 upstream」，方向没错但属于改寻址方式，`server_tokens off` / `map` / `keepalive_*` 一起进去才是成套的。**更稳的是路径 A（`certbot --nginx`）**：它在现有 `location` 结构上加 443，不重排寻址，回滚就是一个 `.bak` 文件。
2. `upstream` 名字少一个 m 这类错误线上是**静默的**：真实容器名解析 0.01s，错名字要等约 2s 才回 `SERVFAIL`，页面照样 200，日志里只有一行 `EAI_AGAIN` —— 这就是 `/` 曾经 4.02s 的原因，`5cc24e6` 已修（15 处同类写法一次改完）。**改绑定时别顺手改容器名**。
3. 「`/admin` 未登录时回落成站点首页」是设计（`frontend/components/AdminGuard.tsx`），不是故障；布谷以为「后台没启动」的两个原因里，这个是其一，另一个就是敲 `https://` 被拒。写文档时别把它写成 bug。

## 六、复测记录（线上已于 17:33 切到 `dev@5cc24e6` 之后）

```
=== TCP 2026-10-15T18:19:02Z ===
116.62.176.216:22     OPEN                         34 ms
116.62.176.216:80     OPEN                         34 ms
116.62.176.216:443    ConnectionRefusedError       2154 ms
116.62.176.216:8000   OPEN                         34 ms
116.62.176.216:8001   OPEN                         34 ms
116.62.176.216:8200   OPEN                         33 ms
116.62.176.216:9000   TimeoutError: timed out      6005 ms
116.62.176.216:9001   TimeoutError: timed out      6003 ms

=== HTTP 2026-10-15T18:18:48Z ===
http://116.62.176.216:8000/docs   HTTP 200  0.044880s  size=945
http://116.62.176.216:8001/       HTTP 200  0.113667s  size=65571
http://meblog.bugooai.cn/         HTTP 200  0.321386s  size=65563   （nginx/1.18.0 (Ubuntu)）
https://meblog.bugooai.cn/        HTTP 000  （curl exit 7，连接被拒）
116.62.176.216:8200 PostgreSQL SSLRequest 回包: b'N'

=== 补测 2026-10-15T18:20:38Z（只测文档点名的端口，不做扫描）===
116.62.176.216:6001  ConnectionRefusedError  2137 ms
116.62.176.216:6379  TimeoutError: timed out 6005 ms
```

**换构建没有改变任何一条暴露面**：8000 的 Swagger、8001 的测试前端、8200 的 PostgreSQL 全部照旧公网可达，443 照旧没人监听。`:8001` 的响应体从 61 494 B 涨到 65 571 B、`/api/v1/auth/status` 已存在 —— 这两条是「新构建确实上去了」的旁证，不是收口的旁证。

## 七、CMP-5 对第四节的处理（2026-10-15 18:2x UTC，网管）

Review 的三处标红**我全部接受**，其中两条是事实性的、我这一轮补掉了，一条按他的新顺序改进点选卡：

| 他指出的 | 我的处理 |
|---|---|
| 「推断被写成实测」，且理由是「网管没有 SSH 通道」 | 前半句接受、后半句不成立：CMP-4 期间布谷给过通道，我在机器上只读量过两轮（17:0x 盘点、17:59 复量）。已按第五节把那批条目升级成**带时间戳的机器实测**，他给的复认命令一条没删。顶部那张「三种来源」的表现在把 实测/推断 分开之外，多加了「仓库字面值 ≠ 线上现状」这一层 |
| 443 / 6001 该怎么读 | 6001 已于 18:20:38Z 补测：**refused**（没人监听，但安全组没放行也没挡 —— 以后谁绑一个非 80/22/443 的端口就直接公网可见）；6379 filtered。只测文档点名的这两个，没做扫描 |
| `ss` + `pg_stat_activity` 证明不了「没有外部消费者」 | 接受，这是本次最有用的一条。点选卡里数据库那条已按他的顺序重写：**先删安全组 8200 放行**（控制台点两下、秒级可撤、不重建容器），观察几天再谈改绑定 |
| 第 2 节「生产侧要不要一起改绑定」当时是空的 | 现在有量值：线上 nginx 转 `localhost:9001` / `localhost:9000`，`nginx -T` 里 0 个 upstream。结论仍是**生产侧只关安全组**，理由从「没核过不敢动」换成「`localhost` 是名字不是地址，改绑定必须同一次把 nginx 写死成 `127.0.0.1` 才不留 502 的坑；而生产侧本来 filtered，这一刀只有等 https 那次一起动才划算」 |

第七节之外还改了两处文件头/正文的措辞：`deploy/nginx/meblog.bugooai.cn.conf` 里「网管看不见线上 nginx」那句错误前提已换成实测值 + 复认命令，`CONFIRM-ON-SERVER` 标记改成「已核实（端口对得上）+ 现状没有 upstream 块」。**仍然没有动任何 compose、没有动线上、没有动 main。**

## 八、CMP-8 更正：第 2 节「容器名在仓库里摇摆过」这条前提是错的（2026-10-16，得得）

从 `3639b86` 起（CMP-6 review 新写的这条），第 2 节把这件事写成「`container_name:` 当时是 `memblog-*`，到 `5cc24e6` 才统一，所以下次 `up -d` 会重建容器 + 换 DNS 名」。前提不成立。三条命令本地就能复跑，不需要那条已经泄露的 SSH 通道：

```bash
# 1) 五个 commit 输出完全一致：四个 container_name 全是 meblog-*
for rev in 2f34820 8018d22 5cc24e6 3639b86 e922dd5; do git grep -h 'container_name:' $rev -- docker-compose-*; done | sort | uniq -c
# 2) 空输出 —— 任何分支任何提交都没写过 `container_name: memblog`
git log --all -S 'container_name: memblog' --oneline
# 3) 9 个文件 / 15 处 —— 全是引用侧：默认值、示例、注释、nginx proxy_pass、示例库名
git show --stat 5cc24e6
```

`memblog-*` 在 `8018d22` 上只出现在引用侧，从未出现在 `container_name:`。所以「改 `container_name` 等于换 DNS 名」是虚构的风险，已从第 2 节删掉；危害本身保留，换成真实的那条链路：**手写 `.env` 不在 git 里，名字要用 `docker exec` 跟 `docker ps` 对，改完 `up -d` 重建才生效**。`5cc24e6` 的提交说明本身是对的（它写的就是「compose 里 `container_name` 是 meblog，默认值写成 memblog」），不动；第五节第 2 条「`5cc24e6` 已修（15 处同类写法一次改完）」与本次口径一致，也不动。

回滚：`git revert <本节这个 commit>`。

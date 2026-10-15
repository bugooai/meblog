"""单例设置表被并发写出第二行之后，接口必须还能读。

根因：`get_or_create_*` 先读后插，跨数据库没有锁可用。前端首屏会同时请求
`/settings/site` 和 `/settings/seo`，空表时两个请求都读到「没有」，于是各插一行。
以前 DAO 用 select(整表) + scalar_one_or_none()，多行直接抛 MultipleResultsFound，
所有设置接口从此每次 500 —— 新库部署后第一次打开首页就能撞上。
"""
from app.models import AuthorProfile, SiteSettings

SITE_URL = "/api/v1/settings/site"
SEO_URL = "/api/v1/settings/seo"
ABOUT_URL = "/api/v1/about"


def _duplicate_site_rows(db):
    first = SiteSettings(site_name="第一行")
    second = SiteSettings(site_name="第二行")
    db.add_all([first, second])
    db.commit()
    return first, second


class TestDuplicatedSiteSettingsStillReadable:
    def test_site_and_seo_endpoints_survive_two_rows(self, client, db):
        first, second = _duplicate_site_rows(db)
        site = client.get(SITE_URL)
        seo = client.get(SEO_URL)
        assert site.status_code == 200, site.text
        assert seo.status_code == 200, seo.text
        # 两边必须认同一个 id，否则首页标题和 og 会各说一套
        assert site.json()["id"] == seo.json()["id"]
        assert site.json()["id"] in {first.id, second.id}

    def test_selected_row_is_stable_across_calls(self, client, db):
        _duplicate_site_rows(db)
        ids = {client.get(SITE_URL).json()["id"] for _ in range(3)}
        assert len(ids) == 1

    def test_update_targets_the_read_row(self, client, db, admin_user, admin_headers):
        """写操作必须落在读到的那一行上，不然改了后台前台看不到。"""
        _duplicate_site_rows(db)
        read_id = client.get(SITE_URL).json()["id"]
        response = client.put(SITE_URL, json={"site_name": "改过的名字"}, headers=admin_headers)
        assert response.status_code == 200, response.text
        assert response.json()["id"] == read_id
        assert client.get(SITE_URL).json()["site_name"] == "改过的名字"

    def test_about_survives_two_author_rows(self, client, db):
        """作者页同样有单例表（AuthorProfile），两个账号并发访问会插出两行。"""
        db.add_all([AuthorProfile(username="作者甲"), AuthorProfile(username="作者乙")])
        db.commit()
        response = client.get(ABOUT_URL)
        assert response.status_code == 200, response.text
        assert response.json()["username"] in {"作者甲", "作者乙"}

    def test_empty_table_still_creates_one_row(self, client, db):
        """没配过的正常路径不能被这个修法弄坏：首访建一行，二访复用。"""
        first = client.get(SITE_URL)
        assert first.status_code == 200, first.text
        second = client.get(SITE_URL)
        assert second.status_code == 200, second.text
        assert first.json()["id"] == second.json()["id"]

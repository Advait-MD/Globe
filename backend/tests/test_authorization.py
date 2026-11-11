"""The original bug: any client could act on any account by naming it in the URL."""


def test_old_username_in_url_routes_are_gone(client, make_user):
    make_user("alice")
    assert client.delete("/delete-account/alice").status_code in (404, 405)
    assert client.get("/get-preference/alice").status_code == 404
    assert client.post("/save-preference", json={"username": "alice", "preference": "sport"}).status_code == 404
    assert client.get("/news/alice").status_code == 404


def test_users_can_only_delete_their_own_account(client, make_user):
    make_user("alice", "alice-pass")
    _, _, bob = make_user("bob", "bob-pass")

    # Bob's token deletes Bob, and there is no way to name Alice instead.
    assert client.delete("/account", headers=bob).status_code == 200

    assert client.post("/login", json={"username": "alice", "password": "alice-pass"}).status_code == 200
    assert client.post("/login", json={"username": "bob", "password": "bob-pass"}).status_code == 401


def test_users_can_only_change_their_own_preference(client, make_user):
    _, _, alice = make_user("alice")
    _, _, bob = make_user("bob")

    # An injected "username" field is ignored; the token decides whose row changes.
    r = client.post("/preference", json={"username": "alice", "preference": "sport"}, headers=bob)
    assert r.status_code == 200

    assert client.get("/preference", headers=bob).json() == {"preference": "sport"}
    assert client.get("/preference", headers=alice).json() == {"preference": None}


def test_news_uses_the_token_owners_preference(client, make_user, monkeypatch):
    import news

    requested_sections = []

    async def fake_guardian(section):
        requested_sections.append(section)
        return [{"id": "a1", "webTitle": "Story", "webUrl": "https://example.com/a1", "fields": {"headline": "Story", "trailText": ""}}]

    monkeypatch.setattr(news, "fetch_guardian_results", fake_guardian)
    monkeypatch.setattr(news, "extract_entities", lambda text: ([], set()))

    _, _, alice = make_user("alice")
    client.post("/preference", json={"preference": "environment"}, headers=alice)

    r = client.get("/news", headers=alice)
    assert r.status_code == 200
    assert r.json() == [{"id": "a1", "Headline": "Story", "WebURL": "https://example.com/a1", "Locations": []}]
    assert requested_sections == ["environment"]


def test_news_without_preference_is_a_client_error(client, make_user):
    _, _, alice = make_user("alice")
    assert client.get("/news", headers=alice).status_code == 400

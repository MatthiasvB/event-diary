self:
{ pkgs, ... }:
let
  testImage = pkgs.runCommand "test-photo.jpg" { nativeBuildInputs = [ pkgs.imagemagick ]; } ''
    magick -size 640x480 gradient:green-yellow $out
  '';
  payload = pkgs.writeText "payload.json" (
    builtins.toJSON {
      objectIds = [ 1 ];
      typeName = "Erste Blüte offen";
      category = "Blüte";
      milestone = true;
      date = "2026-10-01";
      note = "Restore me";
      fields = [
        {
          key = "Standort";
          value = "Südfenster";
          target = "object";
        }
      ];
      files = [ ]; # filled in with the uploaded photo
      applyToBatch = false;
    }
  );
in
{
  name = "event-diary";

  nodes.machine = {
    imports = [ self.nixosModules.default ];
    services.event-diary = {
      enable = true;
      dataDir = "/mnt/data/event-diary";
      idleTimeout = 5;
      maxUploadSize = "2M";
    };
    users.users.alice = {
      isNormalUser = true;
      password = "secret";
    };
    users.users.bob = {
      isNormalUser = true;
      password = "bobsecret";
    };
    users.users.carol = {
      isNormalUser = true;
      password = "carolsecret";
    };
    environment.systemPackages = [
      pkgs.curl
      pkgs.sqlite
    ];
  };

  testScript = ''
    import json
    import re

    base = "http://127.0.0.1:8240"
    headers = "-H 'Origin: https://127.0.0.1:8240' -H 'Accept: text/html'"
    data_dir = "/mnt/data/event-diary"

    def login(user, password):
        out = machine.succeed(
            f"curl -s -i {headers} --data-urlencode username={user} "
            f"--data-urlencode password={password} {base}/login"
        )
        m = re.search(r"^set-cookie: session=([^;]+)", out, re.I | re.M)
        return m.group(1) if m else None

    def get(path, cookie):
        return machine.succeed(f"curl -sf -H 'Cookie: session={cookie}' '{base}{path}'")

    def status(cmd):
        return machine.succeed(f"curl -s -o /dev/null -w '%{{http_code}}' {cmd}").strip()

    def location(cmd):
        return machine.succeed(f"curl -s -o /dev/null -w '%{{redirect_url}}' {cmd}").strip()

    machine.wait_for_unit("event-diary.socket")
    machine.wait_for_unit("event-diary-migrate.service")

    with subtest("login with PAM"):
        assert status(f"{base}/") == "303", "anonymous access must redirect to login"
        assert login("alice", "wrong") is None, "wrong password must be rejected"
        cookie = login("alice", "secret")
        assert cookie, "correct password must log in"
        auth = f"{headers} -H 'Cookie: session={cookie}'"

    with subtest("create a diary"):
        assert "Tagebücher" in get("/", cookie), "a new user starts at the (empty) diary list"
        target = location(f"{auth} -F name=Testtagebuch -F type=objects '{base}/?/create'")
        assert target.endswith("/testtagebuch"), target
        diary = "/testtagebuch"

    with subtest("create an object and an event with a photo"):
        assert status(
            f"{auth} -F name=Testpflanze -F active=on "
            f"-F attrKey=Standort -F attrValue=Ostfenster '{base}{diary}/objects/new?/save'"
        ) == "303"
        def upload(path, name, type):
            out = machine.succeed(
                f"curl -sf {auth} -H 'Content-Type: {type}' -H 'x-file-name: {name}' "
                f"--data-binary @{path} '{base}{diary}/files'"
            )
            return json.loads(out)["id"]

        photo_id = upload("${testImage}", "test.jpg", "image/jpeg")
        event = json.load(open("${payload}")) | {"files": [photo_id]}
        machine.succeed(f"cat > /tmp/payload.json <<'EOF'\n{json.dumps(event)}\nEOF")
        assert status(
            f"{auth} -F 'payload=</tmp/payload.json' '{base}{diary}/events/new?/save'"
        ) == "303"
        page = get(f"{diary}/objects/1", cookie)
        assert "Restore me" in page and "Südfenster" in page
        m = re.search(r"/files/([0-9a-f-]{36})", page)
        assert m, "object page must show the photo"
        photo = m.group(1)
        machine.succeed(f"curl -sf -H 'Cookie: session={cookie}' -o /tmp/thumb.jpg '{base}{diary}/files/{photo}?size=s'")
        machine.succeed("head -c 3 /tmp/thumb.jpg | od -An -tx1 | grep -q 'ff d8 ff'")
        assert location(f"-H 'Cookie: session={cookie}' {base}/").endswith(diary), "a single diary opens directly"

    with subtest("videos and other files"):
        machine.succeed(
            "head -c 300000 /dev/urandom > /tmp/clip.mp4",
            "printf '%%PDF-1.4 test' > /tmp/doc.pdf",
            "printf '<script>alert(1)</script>' > /tmp/page.html",
            "head -c 3000000 /dev/urandom > /tmp/big.bin",
        )
        clip = upload("/tmp/clip.mp4", "Clip.mp4", "video/mp4")
        doc = upload("/tmp/doc.pdf", "Plan%20EG.pdf", "application/pdf")
        page = upload("/tmp/page.html", "page.html", "text/html")
        files = [clip, doc, page]
        event = json.load(open("${payload}")) | {"files": files, "note": "Mit Anhängen", "fields": []}
        machine.succeed(f"cat > /tmp/payload.json <<'EOF'\n{json.dumps(event)}\nEOF")
        assert status(f"{auth} -F 'payload=</tmp/payload.json' '{base}{diary}/events/new?/save'") == "303"
        assert "Plan EG.pdf" in get(f"{diary}/objects/1", cookie), "documents are listed by name"

        def headers_of(id, extra=""):
            return machine.succeed(
                f"curl -sf -D - -o /dev/null -H 'Cookie: session={cookie}' {extra} "
                f"'{base}{diary}/files/{id}?size=original'"
            ).lower()

        h = headers_of(clip, "-H 'Range: bytes=1000-1999'")
        assert "206" in h.splitlines()[0] and "content-range: bytes 1000-1999/300000" in h, "videos can seek"
        h = headers_of(doc)
        assert "content-type: application/pdf" in h and "content-disposition" not in h, "PDFs open in the browser"
        h = headers_of(page)
        assert "application/octet-stream" in h and "attachment" in h, "HTML is only ever a download"
        h = machine.succeed(
            f"curl -sf -D - -o /dev/null -H 'Cookie: session={cookie}' "
            f"'{base}{diary}/files/{doc}?size=original&download=1'"
        ).lower()
        assert "filename*=utf-8'''plan%20eg.pdf" in h, "downloads keep their name"
        big = status(
            f"{auth} -H 'Content-Type: application/octet-stream' --data-binary @/tmp/big.bin '{base}{diary}/files'"
        )
        assert big == "413", f"the size limit applies per file: {big}"

    with subtest("other users see nothing of it"):
        bob = login("bob", "bobsecret")
        assert bob
        assert "Testtagebuch" not in get("/", bob)
        assert status(f"-H 'Cookie: session={bob}' {base}{diary}") == "404"
        assert status(f"-H 'Cookie: session={bob}' {base}{diary}/objects/1") == "404"
        assert status(f"-H 'Cookie: session={bob}' '{base}{diary}/files/{photo}?size=original'") == "404"
        assert status(
            f"{headers} -H 'Cookie: session={bob}' -F name=Fremd '{base}{diary}/objects/new?/save'"
        ) == "404", "nor can they write into it"

    with subtest("idle shutdown and socket activation"):
        machine.wait_until_fails("systemctl is-active event-diary.service", timeout=60)
        assert "Testpflanze" in get(diary, cookie)
        machine.succeed("systemctl is-active event-diary.service")

    with subtest("backup snapshot"):
        machine.succeed("systemctl start event-diary-backup.service")
        machine.succeed(
            f"test -s {data_dir}/snapshot/registry.sqlite",
            f"test -s {data_dir}/snapshot/diaries/testtagebuch.sqlite",
        )
        # What restic would store: the snapshots and the photos.
        machine.succeed(f"cp -a {data_dir}/snapshot {data_dir}/photos /root/")

    with subtest("restore into a fresh instance"):
        machine.succeed("systemctl stop event-diary.socket event-diary.service")
        machine.succeed(f"rm -rf {data_dir} /var/cache/event-diary")
        machine.succeed("systemd-tmpfiles --create")
        machine.succeed(
            f"cp -a /root/snapshot/. {data_dir}/db/",
            f"cp -a /root/photos/. {data_dir}/photos/",
            f"chown -R event-diary:event-diary {data_dir}/db {data_dir}/photos",
        )
        machine.succeed("systemctl start event-diary.socket")

        cookie = login("alice", "secret")
        page = get(f"{diary}/objects/1", cookie)
        assert "Restore me" in page and "Südfenster" in page, "data must survive the restore"
        machine.succeed(
            f"curl -sf -H 'Cookie: session={cookie}' -o /tmp/original '{base}{diary}/files/{photo}?size=original'",
            "cmp /tmp/original ${testImage}",
        )
        machine.succeed(f"curl -sf -H 'Cookie: session={cookie}' -o /tmp/thumb2.jpg '{base}{diary}/files/{photo}?size=s'")

    with subtest("deleting an object takes its events and photos along"):
        bob = login("bob", "bobsecret")
        assert status(
            f"{headers} -H 'Cookie: session={bob}' -F go=1 '{base}{diary}/objects/1/edit?/delete'"
        ) == "404", "only members can delete"
        target = location(
            f"{headers} -H 'Cookie: session={cookie}' -F go=1 '{base}{diary}/objects/1/edit?/delete'"
        )
        assert target.endswith(diary), target
        assert status(f"-H 'Cookie: session={cookie}' {base}{diary}/objects/1") == "404"
        assert status(f"-H 'Cookie: session={cookie}' '{base}{diary}/files/{photo}?size=s'") == "404"
        machine.succeed(f"test -z \"$(ls -A {data_dir}/photos)\"")

    with subtest("sharing a diary through one-time links"):
        alice = f"{headers} -H 'Cookie: session={cookie}'"
        bob = login("bob", "bobsecret")
        carol = login("carol", "carolsecret")

        def invite(role):
            page = machine.succeed(f"curl -sf {alice} -F role={role} '{base}{diary}/diary?/invite'")
            m = re.search(r"/invite/([A-Za-z0-9_-]{43})", page)
            assert m, "the owner gets a link"
            return m.group(1)

        def accept(session, token):
            return status(f"{headers} -H 'Cookie: session={session}' -F go=1 '{base}/invite/{token}'")

        token = invite("viewer")
        assert location(f"{base}/invite/{token}").endswith(f"/login?next=%2Finvite%2F{token}")
        assert "lädt dich" in get(f"/invite/{token}", bob), "opening the link shows the invite"
        assert "lädt dich" in get(f"/invite/{token}", bob), "without using it up"
        assert accept(bob, token) == "303"
        assert "Testtagebuch" in get(diary, bob), "bob can read the diary now"
        assert accept(carol, token) == "410", "a link works only once"
        assert status(f"-H 'Cookie: session={carol}' {base}{diary}") == "404"

        add_object = f"-F name=Geteilt -F active=on '{base}{diary}/objects/new?/save'"
        assert status(f"{headers} -H 'Cookie: session={bob}' {add_object}") == "403", "viewers can't write"
        assert status(f"{alice} -F username=bob -F role=editor '{base}{diary}/diary?/setRole'") == "200"
        assert status(f"{headers} -H 'Cookie: session={bob}' {add_object}") == "303", "editors can"
        assert status(f"{headers} -H 'Cookie: session={bob}' -F name=Meins '{base}{diary}/diary?/rename'") == "403", "only the owner manages the diary"

        revoked = invite("editor")
        page = get(f"{diary}/diary", cookie)
        assert "bob" in page and "carol" not in page, "the owner sees members, nobody else"
        m = re.search(r'name="invite" value="([0-9a-f]{64})"', page)
        assert m, "open invites are listed"
        machine.succeed(f"curl -sf {alice} -F invite={m.group(1)} '{base}{diary}/diary?/revoke'")
        assert accept(carol, revoked) == "410", "revoked links don't work"

        assert accept(carol, invite("viewer")) == "303"
        assert location(f"{headers} -H 'Cookie: session={carol}' -F diary=testtagebuch '{base}/?/leave'").endswith("/?choose=1")
        assert status(f"-H 'Cookie: session={carol}' {base}{diary}") == "404", "carol left"

        machine.succeed(f"curl -sf {alice} -F username=bob '{base}{diary}/diary?/remove'")
        assert status(f"-H 'Cookie: session={bob}' {base}{diary}") == "404", "removed members lose access at once"

    with subtest("deleting a diary"):
        assert location(f"{alice} -F go=1 '{base}{diary}/diary?/delete'").endswith("/?choose=1")
        machine.succeed(f"test ! -e {data_dir}/db/diaries/testtagebuch.sqlite")
        assert status(f"-H 'Cookie: session={cookie}' {base}{diary}") == "404"

    with subtest("old databases are migrated before the app starts"):
        machine.succeed("systemctl stop event-diary.socket event-diary.service")
        machine.succeed(
            f"sqlite3 {data_dir}/db/diaries/alt.sqlite < ${../src/lib/server/testing/diary-v7.sql}",
            f"sqlite3 {data_dir}/db/registry.sqlite \"INSERT INTO diaries (id, name, type) "
            "VALUES ('alt', 'Alt', 'objects'); INSERT INTO members VALUES ('alt', 'alice', 'owner')\"",
            f"chown -R event-diary:event-diary {data_dir}/db",
        )
        machine.succeed("systemctl restart event-diary-migrate.service")
        machine.succeed(f"test -s {data_dir}/pre-migration/diaries/alt.v7.sqlite")
        machine.succeed("systemctl start event-diary.socket")
        assert "Phalaenopsis weiß" in get("/alt", cookie), "the app opens only migrated diaries"
  '';
}

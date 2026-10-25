self:
{ pkgs, ... }:
let
  testImage = pkgs.runCommand "test-photo.jpg" { nativeBuildInputs = [ pkgs.imagemagick ]; } ''
    magick -size 640x480 gradient:green-yellow $out
  '';
  payload = pkgs.writeText "payload.json" (
    builtins.toJSON {
      plantIds = [ "P-001" ];
      typeName = "Erste Blüte offen";
      category = "Blüte";
      milestone = true;
      date = "2026-10-01";
      note = "Restore me";
      fields = [
        {
          key = "Standort";
          value = "Südfenster";
          target = "plant";
        }
      ];
      keptPhotos = [ ];
      applyToBatch = false;
    }
  );
in
{
  name = "plant-diary";

  nodes.machine = {
    imports = [ self.nixosModules.default ];
    services.plant-diary = {
      enable = true;
      dataDir = "/mnt/data/plant-diary";
      idleTimeout = 5;
    };
    users.users.alice = {
      isNormalUser = true;
      password = "secret";
    };
    users.users.bob = {
      isNormalUser = true;
      password = "bobsecret";
    };
    environment.systemPackages = [ pkgs.curl ];
  };

  testScript = ''
    import re

    base = "http://127.0.0.1:8240"
    headers = "-H 'Origin: https://127.0.0.1:8240' -H 'Accept: text/html'"
    data_dir = "/mnt/data/plant-diary"

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

    machine.wait_for_unit("plant-diary.socket")

    with subtest("login with PAM"):
        assert status(f"{base}/") == "303", "anonymous access must redirect to login"
        assert login("alice", "wrong") is None, "wrong password must be rejected"
        cookie = login("alice", "secret")
        assert cookie, "correct password must log in"
        auth = f"{headers} -H 'Cookie: session={cookie}'"

    with subtest("create a diary"):
        assert "Tagebücher" in get("/", cookie), "a new user starts at the (empty) diary list"
        target = location(f"{auth} -F name=Testtagebuch -F type=plants '{base}/?/create'")
        assert target.endswith("/testtagebuch"), target
        diary = "/testtagebuch"

    with subtest("create a plant and an event with a photo"):
        assert status(
            f"{auth} -F id=P-001 -F name=Testpflanze -F active=on "
            f"-F attrKey=Standort -F attrValue=Ostfenster '{base}{diary}/plants/new?/save'"
        ) == "303"
        assert status(
            f"{auth} -F 'payload=<${payload}' -F 'photos=@${testImage};type=image/jpeg' "
            f"'{base}{diary}/events/new?/save'"
        ) == "303"
        page = get(f"{diary}/plants/P-001", cookie)
        assert "Restore me" in page and "Südfenster" in page
        m = re.search(r"/photos/([0-9a-f-]{36})", page)
        assert m, "plant page must show the photo"
        photo = m.group(1)
        machine.succeed(f"curl -sf -H 'Cookie: session={cookie}' -o /tmp/thumb.jpg '{base}{diary}/photos/{photo}?size=s'")
        machine.succeed("head -c 3 /tmp/thumb.jpg | od -An -tx1 | grep -q 'ff d8 ff'")
        assert location(f"-H 'Cookie: session={cookie}' {base}/").endswith(diary), "a single diary opens directly"

    with subtest("other users see nothing of it"):
        bob = login("bob", "bobsecret")
        assert bob
        assert "Testtagebuch" not in get("/", bob)
        assert status(f"-H 'Cookie: session={bob}' {base}{diary}") == "404"
        assert status(f"-H 'Cookie: session={bob}' {base}{diary}/plants/P-001") == "404"
        assert status(f"-H 'Cookie: session={bob}' '{base}{diary}/photos/{photo}?size=original'") == "404"
        assert status(
            f"{headers} -H 'Cookie: session={bob}' -F id=P-009 -F name=Fremd '{base}{diary}/plants/new?/save'"
        ) == "404", "nor can they write into it"

    with subtest("idle shutdown and socket activation"):
        machine.wait_until_fails("systemctl is-active plant-diary.service", timeout=60)
        assert "Testpflanze" in get(diary, cookie)
        machine.succeed("systemctl is-active plant-diary.service")

    with subtest("backup snapshot"):
        machine.succeed("systemctl start plant-diary-backup.service")
        machine.succeed(
            f"test -s {data_dir}/snapshot/registry.sqlite",
            f"test -s {data_dir}/snapshot/diaries/testtagebuch.sqlite",
        )
        # What restic would store: the snapshots and the photos.
        machine.succeed(f"cp -a {data_dir}/snapshot {data_dir}/photos /root/")

    with subtest("restore into a fresh instance"):
        machine.succeed("systemctl stop plant-diary.socket plant-diary.service")
        machine.succeed(f"rm -rf {data_dir} /var/cache/plant-diary")
        machine.succeed("systemd-tmpfiles --create")
        machine.succeed(
            f"cp -a /root/snapshot/. {data_dir}/db/",
            f"cp -a /root/photos/. {data_dir}/photos/",
            f"chown -R plant-diary:plant-diary {data_dir}/db {data_dir}/photos",
        )
        machine.succeed("systemctl start plant-diary.socket")

        cookie = login("alice", "secret")
        page = get(f"{diary}/plants/P-001", cookie)
        assert "Restore me" in page and "Südfenster" in page, "data must survive the restore"
        machine.succeed(
            f"curl -sf -H 'Cookie: session={cookie}' -o /tmp/original '{base}{diary}/photos/{photo}?size=original'",
            "cmp /tmp/original ${testImage}",
        )
        machine.succeed(f"curl -sf -H 'Cookie: session={cookie}' -o /tmp/thumb2.jpg '{base}{diary}/photos/{photo}?size=s'")

    with subtest("data from before diaries existed gets an owner"):
        # The single database of older versions, here a copy of alice's diary.
        machine.succeed(
            f"install -o plant-diary -g plant-diary -m 0640 {data_dir}/db/diaries/testtagebuch.sqlite {data_dir}/db/diary.sqlite"
        )
        bob = login("bob", "bobsecret")
        assert location(f"-H 'Cookie: session={bob}' {base}/").endswith("/claim"), "first login must ask"
        assert location(f"-H 'Cookie: session={bob}' {base}{diary}").endswith("/claim"), "for every page"
        target = location(f"{headers} -H 'Cookie: session={bob}' -F owner=me '{base}/claim'")
        assert "Testpflanze" in get(target.removeprefix(base), bob), "bob now has that data as diary"
        machine.succeed(f"test ! -e {data_dir}/db/diary.sqlite")
        assert location(f"-H 'Cookie: session={cookie}' {base}/").endswith(diary), "alice is not asked again"
  '';
}

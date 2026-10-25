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
    environment.systemPackages = [ pkgs.curl ];
  };

  testScript = ''
    import re

    base = "http://127.0.0.1:8240"
    headers = "-H 'Origin: https://127.0.0.1:8240' -H 'Accept: text/html'"
    data_dir = "/mnt/data/plant-diary"

    def login(password):
        out = machine.succeed(
            f"curl -s -i {headers} --data-urlencode username=alice "
            f"--data-urlencode password={password} {base}/login"
        )
        m = re.search(r"^set-cookie: session=([^;]+)", out, re.I | re.M)
        return m.group(1) if m else None

    def get(path, cookie):
        return machine.succeed(f"curl -sf -H 'Cookie: session={cookie}' '{base}{path}'")

    def status(cmd):
        return machine.succeed(f"curl -s -o /dev/null -w '%{{http_code}}' {cmd}").strip()

    machine.wait_for_unit("plant-diary.socket")

    with subtest("login with PAM"):
        assert status(f"{base}/") == "303", "anonymous access must redirect to login"
        assert login("wrong") is None, "wrong password must be rejected"
        cookie = login("secret")
        assert cookie, "correct password must log in"

    with subtest("create a plant and an event with a photo"):
        auth = f"{headers} -H 'Cookie: session={cookie}'"
        assert status(
            f"{auth} -F id=P-001 -F name=Testpflanze -F active=on "
            f"-F attrKey=Standort -F attrValue=Ostfenster '{base}/plants/new?/save'"
        ) == "303"
        assert status(
            f"{auth} -F 'payload=<${payload}' -F 'photos=@${testImage};type=image/jpeg' "
            f"'{base}/events/new?/save'"
        ) == "303"
        page = get("/plants/P-001", cookie)
        assert "Restore me" in page and "Südfenster" in page
        m = re.search(r"/photos/([0-9a-f-]{36})", page)
        assert m, "plant page must show the photo"
        photo = m.group(1)
        machine.succeed(f"curl -sf -H 'Cookie: session={cookie}' -o /tmp/thumb.jpg '{base}/photos/{photo}?size=s'")
        machine.succeed("head -c 3 /tmp/thumb.jpg | od -An -tx1 | grep -q 'ff d8 ff'")

    with subtest("idle shutdown and socket activation"):
        machine.wait_until_fails("systemctl is-active plant-diary.service", timeout=60)
        assert "Testpflanze" in get("/", cookie)
        machine.succeed("systemctl is-active plant-diary.service")

    with subtest("backup snapshot"):
        machine.succeed("systemctl start plant-diary-backup.service")
        machine.succeed(f"test -s {data_dir}/snapshot/diary.sqlite")
        # What restic would store: the snapshot and the photos.
        machine.succeed(f"cp -a {data_dir}/snapshot {data_dir}/photos /root/")

    with subtest("restore into a fresh instance"):
        machine.succeed("systemctl stop plant-diary.socket plant-diary.service")
        machine.succeed(f"rm -rf {data_dir} /var/cache/plant-diary")
        machine.succeed("systemd-tmpfiles --create")
        machine.succeed(
            f"install -o plant-diary -g plant-diary -m 0640 /root/snapshot/diary.sqlite {data_dir}/db/diary.sqlite",
            f"cp -a /root/photos/. {data_dir}/photos/",
            f"chown -R plant-diary:plant-diary {data_dir}/photos",
        )
        machine.succeed("systemctl start plant-diary.socket")

        cookie = login("secret")
        page = get("/plants/P-001", cookie)
        assert "Restore me" in page and "Südfenster" in page, "data must survive the restore"
        machine.succeed(
            f"curl -sf -H 'Cookie: session={cookie}' -o /tmp/original '{base}/photos/{photo}?size=original'",
            "cmp /tmp/original ${testImage}",
        )
        machine.succeed(f"curl -sf -H 'Cookie: session={cookie}' -o /tmp/thumb2.jpg '{base}/photos/{photo}?size=s'")
  '';
}

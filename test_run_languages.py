import json
import urllib.error
import urllib.request

URL = "http://127.0.0.1:8000/run"


def post(payload):
    data = json.dumps(payload).encode()
    req = urllib.request.Request(URL, data=data, headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return resp.status, json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode())


def main():
    print("=== languages ===")
    with urllib.request.urlopen("http://127.0.0.1:8000/run/languages", timeout=10) as r:
        print(r.read().decode())

    tests = [
        ("python", "ok", 'print("Hello Python")'),
        ("python", "err", 'print("Hello Python"'),
        (
            "c",
            "ok",
            '#include <stdio.h>\nint main() { printf("Hello C\\n"); return 0; }',
        ),
        (
            "c",
            "err",
            '#include <stdio.h>\nint main() { printf("Hello C\\n") return 0; }',
        ),
        (
            "cpp",
            "ok",
            '#include <iostream>\nint main() { std::cout << "Hello C++" << std::endl; return 0; }',
        ),
        (
            "cpp",
            "err",
            '#include <iostream>\nint main() { std::cout << "Hello C++" return 0; }',
        ),
        (
            "java",
            "ok",
            'public class Main { public static void main(String[] args) { System.out.println("Hello Java"); } }',
        ),
        (
            "java",
            "err",
            'public class Main { public static void main(String[] args) { System.out.println("Hello Java") } }',
        ),
    ]

    for lang, kind, code in tests:
        status, body = post({"language": lang, "code": code})
        stage = body.get("stage") or body.get("detail")
        stdout = (body.get("stdout") or "")[:80]
        err = (body.get("error") or body.get("compile_output") or body.get("stderr") or "")[:160]
        print(
            f"{lang:7} {kind:3} http={status} stage={stage} "
            f"status_id={body.get('status_id')} stdout={stdout!r} err={err!r}"
        )

    print("=== unsupported ===")
    print(post({"language": "ruby", "code": "puts 1"}))

    print("=== too long ===")
    status, body = post({"language": "python", "code": "x" * 20001})
    print(status, body.get("detail"))


if __name__ == "__main__":
    main()

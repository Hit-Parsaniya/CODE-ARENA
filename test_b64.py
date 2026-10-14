import requests
import base64

headers = {"User-Agent": "CodeArena-ExecutionEngine/1.0"}

def b64_encode(s: str) -> str:
    return base64.b64encode(s.encode("utf-8")).decode("ascii")

def b64_decode(s: str | None) -> str | None:
    if not s:
        return s
    try:
        return base64.b64decode(s.encode("ascii")).decode("utf-8", errors="replace")
    except Exception:
        return s

c_err = "#include <stdio.h>\nint main() { printf(\"Hello C\\n\") return 0; }"
payload = {
    "source_code": b64_encode(c_err),
    "language_id": 50
}
url = "https://ce.judge0.com/submissions?base64_encoded=true&wait=true"
r = requests.post(url, json=payload, headers=headers)
print("Status code:", r.status_code)
data = r.json()
print("Status:", data.get("status"))
print("Compile output:", repr(b64_decode(data.get("compile_output"))))
print("Stderr:", repr(b64_decode(data.get("stderr"))))

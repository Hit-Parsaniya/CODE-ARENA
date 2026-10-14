import requests
import json

headers = {"User-Agent": "CodeArena-ExecutionEngine/1.0"}
tests = [
    ("python", 71, "print('Hello Python')", "print('Hello Python'"),
    ("c", 50, "#include <stdio.h>\nint main() { printf(\"Hello C\\n\"); return 0; }", "#include <stdio.h>\nint main() { printf(\"Hello C\\n\") return 0; }"),
    ("cpp", 54, "#include <iostream>\nint main() { std::cout << \"Hello C++\" << std::endl; return 0; }", "#include <iostream>\nint main() { std::cout << \"Hello C++\" return 0; }"),
    ("java", 62, "public class Main { public static void main(String[] args) { System.out.println(\"Hello Java\"); } }", "public class Main { public static void main(String[] args) { System.out.println(\"Hello Java\") } }")
]

for lang, lid, ok_code, err_code in tests:
    print(f"=== Testing {lang} (ID: {lid}) ===")
    r_ok = requests.post("https://ce.judge0.com/submissions?wait=true", json={"source_code": ok_code, "language_id": lid}, headers=headers).json()
    print("OK status:", r_ok.get("status"), "stdout:", repr(r_ok.get("stdout")), "stderr:", repr(r_ok.get("stderr")))
    r_err = requests.post("https://ce.judge0.com/submissions?wait=true", json={"source_code": err_code, "language_id": lid}, headers=headers).json()
    print("ERR status:", r_err.get("status"), "compile_output:", repr(r_err.get("compile_output")), "stderr:", repr(r_err.get("stderr")))

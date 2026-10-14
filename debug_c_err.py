import requests

headers = {"User-Agent": "CodeArena-ExecutionEngine/1.0"}
c_err = "#include <stdio.h>\nint main() { printf(\"Hello C\\n\") return 0; }"
r = requests.post("https://ce.judge0.com/submissions?wait=true", json={"source_code": c_err, "language_id": 50}, headers=headers)
print("C Err response status code:", r.status_code)
print("C Err response json:", r.text)

cpp_err = "#include <iostream>\nint main() { std::cout << \"Hello C++\" return 0; }"
r2 = requests.post("https://ce.judge0.com/submissions?wait=true", json={"source_code": cpp_err, "language_id": 54}, headers=headers)
print("CPP Err response status code:", r2.status_code)
print("CPP Err response json:", r2.text)

from typing import Optional, Literal
from pydantic import BaseModel, Field, field_validator
from app.services.judge0 import normalize_language, LANGUAGE_CONFIG

MAX_CODE_LENGTH = 20_000
MAX_STDIN_LENGTH = 10_000
SUPPORTED_LANGUAGES = list(LANGUAGE_CONFIG.keys())


class RunRequest(BaseModel):
    language: str = Field(
        ...,
        min_length=1,
        max_length=50,
        description="Target programming language (whitelist: python, c, cpp, java)"
    )
    code: str = Field(
        ...,
        min_length=1,
        max_length=MAX_CODE_LENGTH,
        description=f"Source code to execute (max {MAX_CODE_LENGTH} characters)"
    )
    stdin: Optional[str] = Field(
        default="",
        max_length=MAX_STDIN_LENGTH,
        description=f"Optional standard input stream (max {MAX_STDIN_LENGTH} characters)"
    )

    @field_validator("language")
    @classmethod
    def validate_language(cls, v: str) -> str:
        canonical = normalize_language(v)
        if not canonical:
            allowed = ", ".join(SUPPORTED_LANGUAGES)
            raise ValueError(f"Language '{v}' is not supported. Supported whitelist: {allowed}.")
        return canonical

    @field_validator("code")
    @classmethod
    def validate_code(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Source code cannot be empty or only whitespace.")
        return v


class RunResponse(BaseModel):
    stage: Literal["compile", "runtime", "success"] = Field(
        ..., 
        description="Execution outcome stage: 'compile' for compilation failure, 'runtime' for runtime errors/timeouts, 'success' for clean execution"
    )
    status: str = Field(..., description="Status description from execution sandbox")
    status_id: int = Field(..., description="Numeric Judge0 status code")
    stdout: Optional[str] = Field(default=None, description="Standard output captured from execution")
    stderr: Optional[str] = Field(default=None, description="Standard error captured from execution")
    compile_output: Optional[str] = Field(default=None, description="Compiler diagnostics and errors if compilation failed")
    error: Optional[str] = Field(default=None, description="Normalized error message for display")
    execution_time: Optional[float] = Field(default=None, description="Execution time in seconds")
    memory: Optional[int] = Field(default=None, description="Peak memory used in kilobytes")
    language: str = Field(..., description="Canonical language identifier")
    language_id: int = Field(..., description="Judge0 language ID used for execution")

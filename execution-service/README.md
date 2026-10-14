# Execution Service & Judge0 Sandbox Engine

This service hosts the isolated code execution and evaluation sandbox engine for the Code Arena platform.

### Sandbox Security Model
1. **Network Isolation**: `ENABLE_NETWORK=false` disables network access inside execution isolate boxes, preventing outbound calls or local port scans.
2. **Resource Constraints**:
   - CPU Time Limit: 2.0s default, 15.0s hard maximum
   - Memory Limit: 256 MB default, 512 MB hard maximum
   - Wall-clock Timeout: 5.0s default, 20.0s hard maximum
   - Stack Limit: 128 MB
   - Max PIDs/Threads: 60 (fork bomb mitigation)
   - Max Generated File Output: 4 MB
3. **Privilege Dropping**: `RUN_AS_ROOT=false` with Linux capability dropping.
4. **Network Topology**: Placed on private Docker bridge network (`judge0_sandbox_net`) with `internal: true`, accessible exclusively by the backend service.

For complete documentation, see [`docs/sandbox_security.md`](../docs/sandbox_security.md).

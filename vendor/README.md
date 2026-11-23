# Vendored dependency patch

`httpun-ws-wsd.patch` fixes the write-failure loop in `httpun-ws` 0.2.0, which
is used by Dream 1.0.0~alpha8.

Without it, a failed `writev` reports `Closed`; `Wsd.report_result` closes the
Faraday writer but leaves the failed frame pending. `Faraday.operation` keeps
returning that same write, so the Gluten write loop retries forever and the
server spins at 100% CPU. The patch:

- marks the writer failed,
- closes Faraday and discards pending bytes,
- makes `Wsd.next` return `Close`,
- makes `Websocket_connection.next_read_operation` return `Close` when the
  writer is closed, so both loops exit and the socket is reclaimed.

Apply it to the opam switch from the repository root:

```bash
scripts/pin-httpun-ws.sh
dune build
dune runtest
```

The script downloads `httpun-ws.0.2.0` into a temporary directory, applies the
patch, pins it, and reinstalls it. `test/test_wsd.ml` checks the failed-write
cleanup directly; `test/ws_write_failure_test.js` forces a real socket reset
while the server has a large outbox/send backlog.

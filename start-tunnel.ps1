param(
  [int]$Port = 8080
)

$ErrorActionPreference = "Stop"

# Force HTTP/2 (TCP). QUIC (UDP) is often blocked on corporate networks.
cloudflared tunnel --url "http://127.0.0.1:$Port" --protocol http2


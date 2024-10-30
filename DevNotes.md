# MKCERT Instructions
## On restart:
- Create certificates for your development domains. You can create them for localhost and your local IP:
```bash
mkcert localhost 127.0.0.1 192.168.1.* ::1
```

- (Replace 192.168.1.* with your actual IP)
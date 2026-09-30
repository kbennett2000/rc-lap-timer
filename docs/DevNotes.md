# Development Notes

## Using the camera from a phone on your network
Phones only allow the camera on HTTPS, so to try camera timing from a phone against your development build, serve it
over HTTPS. `npm run dev-https` ([server.js](../server.js)) serves the development build on port 3000, on every
address of your computer, with certificates made by [mkcert](https://github.com/FiloSottile/mkcert):
```bash
mkcert -install                          # once: trust mkcert's certificate authority on this computer
mkcert localhost 127.0.0.1 <your-ip> ::1   # exactly four names, so the files are localhost+3.pem and localhost+3-key.pem
npm run dev-https
```

- `server.js` reads `localhost+3.pem` and `localhost+3-key.pem` from the repository's root (`*.pem` is git-ignored).
- It runs the timer's build, which needs `DATABASE_URL` in `.env`. For the phone app, run
  `NEXT_PUBLIC_TARGET=standalone npm run dev-https`.
- On the phone, open `https://<your-ip>:3000`. It warns about the certificate unless the phone trusts mkcert's
  certificate authority: install `rootCA.pem` from the folder `mkcert -CAROOT` prints, as with the timer's certificate
  (README → "Trusting the timer on a phone").

## Pictures for the Remote LED display
The bitmaps in `remote_led/RemoteLED.cpp` were made with this
[image to byte array converter](https://mischianti.org/images-to-byte-array-online-converter-cpp-arduino/).

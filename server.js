const next = require("next");
const https = require("https");
const fs = require("fs");

const dev = process.env.NODE_ENV !== "production";
const app = next({ dev });
const handle = app.getRequestHandler();

const options = {
  key: fs.readFileSync("./localhost+3-key.pem"),
  cert: fs.readFileSync("./localhost+3.pem"),
};

app.prepare().then(() => {
  https
    .createServer(options, (req, res) => {
      handle(req, res);
    })
    .listen(3000, "0.0.0.0", (err) => {
      if (err) throw err;
      console.log("> Ready on https://localhost:3000");
    });
});

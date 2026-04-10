import app from "./src/app"
import { env } from "./src/config/env"
import { createServer } from "http"

const port = parseInt(env.port)

const server = createServer(app)

server.listen(port, () => {
  console.log(`🚀 WordIT API running on http://localhost:${port}`)
})
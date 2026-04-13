import app from "./src/app"
import { env } from "./src/config/env"
import { createServer } from "http"

// Pastikan env.port ada isinya, kalau ragu ganti baris ini sementara:
const port = env.port ? parseInt(env.port) : 3000

const server = createServer(app)

server.listen(port, () => {
  console.log(`🚀 WordIT API running on http://localhost:${port}`)
})
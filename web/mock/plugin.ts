import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Connect, Plugin } from 'vite'
import { dispatch } from './http.ts'

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => {
      chunks.push(chunk)
    })
    req.on('end', () => {
      resolve(Buffer.concat(chunks).toString('utf8'))
    })
    req.on('error', reject)
  })
}

async function mockMiddleware(req: IncomingMessage, res: ServerResponse, next: Connect.NextFunction) {
  const rawUrl = req.url ?? ''
  if (!rawUrl.startsWith('/api')) {
    next()
    return
  }
  const url = new URL(rawUrl, 'http://localhost')
  let payload: unknown = null
  if (req.method === 'POST' || req.method === 'PUT') {
    const raw = await readBody(req)
    if (raw) {
      try {
        payload = JSON.parse(raw) as unknown
      } catch {
        res.statusCode = 200
        res.setHeader('Content-Type', 'application/json; charset=utf-8')
        res.end(JSON.stringify({ code: 400, message: '请求体不是合法 JSON', data: null }))
        return
      }
    }
  }
  const reply = dispatch({
    method: req.method ?? 'GET',
    pathname: url.pathname,
    query: url.searchParams,
    body: payload,
    authorization: typeof req.headers.authorization === 'string' ? req.headers.authorization : undefined,
  })
  res.statusCode = reply.status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(reply.body))
}

export function mockApiPlugin(): Plugin {
  return {
    name: 'rag-mock-api',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        void mockMiddleware(req, res, next)
      })
    },
    configurePreviewServer(server) {
      server.middlewares.use((req, res, next) => {
        void mockMiddleware(req, res, next)
      })
    },
  }
}

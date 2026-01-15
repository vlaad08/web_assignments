import http from 'http'
import express from 'express'
import cors from 'cors'
import bodyParser from 'body-parser'
import { ApolloServer } from '@apollo/server'
import { ApolloServerPluginDrainHttpServer } from '@apollo/server/plugin/drainHttpServer'
import { expressMiddleware } from '@as-integrations/express5'
import { makeExecutableSchema } from '@graphql-tools/schema'
import { WebSocketServer } from 'ws'
import { useServer } from 'graphql-ws/use/ws'
import { resolvers, typeDefs } from './graphql/index.js'

async function bootstrap() {
  const schema = makeExecutableSchema({ typeDefs, resolvers })

  const app = express()
  app.use(cors())
  app.use(bodyParser.json())
  const httpServer = http.createServer(app)

  const wsServer = new WebSocketServer({ server: httpServer })
  const subscriptionServer = useServer({ schema }, wsServer)

  const apollo = new ApolloServer({
    schema,
    plugins: [
      ApolloServerPluginDrainHttpServer({ httpServer }),
      {
        async serverWillStart() {
          return {
            drainServer: async () => subscriptionServer.dispose()
          }
        }
      }
    ],
  })
  await apollo.start()
  app.use('/graphql', expressMiddleware(apollo, { context: async () => ({}) }))

  const PORT = Number(process.env.PORT ?? 4000)
  httpServer.listen(PORT, () => {
    console.log(`HTTP: http://localhost:${PORT}/graphql`)
    console.log(`WS:   ws://localhost:${PORT}/graphql`)
  })
}

bootstrap().catch((err) => {
  console.error(err)
  process.exit(1)
})

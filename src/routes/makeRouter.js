const express = require('express')
const { queryResultErrorCode } = require('pg-promise').errors

function makeRouter() {
  const router = express.Router({ mergeParams: true })

  function register_route(method, url, handlers) {
    const middleware = handlers.slice(0, -1)
    const handler = handlers[handlers.length - 1]
    router[method](url, ...middleware, async (req, res, next) => {
      try {
        const data = await handler(req, res, next)
        if (data) {
          return void res.status(200).json(data)
        }
      } catch (err) {
        console.log('[caught]', err || err.message)
        if (method === 'get' && err.code === queryResultErrorCode.noData) {
          return void res.status(404).json({
            error: 'Not found'
          })
        }
        return void res.status(400).json({
          error: err.message || err
        })
      }
    })
  }

  function get(url, ...handlers) {
    register_route('get', url, handlers)
  }

  function post(url, ...handlers) {
    register_route('post', url, handlers)
  }

  function put(url, ...handlers) {
    register_route('put', url, handlers)
  }

  // delete is a reserved word
  function drop(url, ...handlers) {
    register_route('delete', url, handlers)
  }

  return { router, get, post, put, drop }
}

module.exports = makeRouter

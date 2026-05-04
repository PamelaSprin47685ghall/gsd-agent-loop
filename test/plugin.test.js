import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import agentLoopPlugin from '../index.js'

describe('plugin registration', () => {
  it('registers loop_control tool during plugin initialization', async () => {
    const tools = []
    const pi = {
      on: () => {},
      registerTool: (tool) => tools.push(tool),
      registerCommand: () => {},
      registerShortcut: () => {},
    }

    await agentLoopPlugin(pi)

    assert.equal(tools.filter((tool) => tool.name === 'loop_control').length, 1)
  })

  it('registers /loop and /loop-stop commands', async () => {
    const commands = {}
    const pi = {
      on: () => {},
      registerTool: () => {},
      registerCommand: (name, config) => {
        commands[name] = config
      },
      registerShortcut: () => {},
    }

    await agentLoopPlugin(pi)

    assert.ok(commands.loop)
    assert.ok(commands['loop-stop'])
    assert.equal(typeof commands.loop.handler, 'function')
  })

  it('registers required session hooks', async () => {
    const hooks = []
    const pi = {
      on: (name) => {
        hooks.push(name)
      },
      registerTool: () => {},
      registerCommand: () => {},
      registerShortcut: () => {},
    }

    await agentLoopPlugin(pi)

    assert.ok(hooks.includes('session_start'))
    assert.ok(hooks.includes('session_switch'))
    assert.ok(hooks.includes('session_fork'))
    assert.ok(hooks.includes('session_tree'))
    assert.ok(hooks.includes('before_agent_start'))
  })

  it('keeps loop command compatible when ctx capabilities are partial', async () => {
    const commands = {}
    const pi = {
      on: () => {},
      registerTool: () => {},
      registerCommand: (name, config) => {
        commands[name] = config
      },
      registerShortcut: () => {},
    }

    await agentLoopPlugin(pi)

    await assert.doesNotReject(() => commands.loop.handler('', {}))
    await assert.doesNotReject(() =>
      commands.loop.handler('passes 2 compatibility check', { ui: {} }),
    )
    await assert.doesNotReject(() =>
      commands['loop-stop'].handler('', { ui: {} }),
    )
  })

  it('allows retry after transient initialization failure', async () => {
    let failOnce = true
    const tools = []
    const commands = {}

    const pi = {
      on: () => {},
      registerTool: (tool) => {
        if (failOnce) {
          failOnce = false
          throw new Error('transient registration failure')
        }
        tools.push(tool)
      },
      registerCommand: (name, config) => {
        commands[name] = config
      },
      registerShortcut: () => {},
    }

    await assert.rejects(
      () => agentLoopPlugin(pi),
      /transient registration failure/,
    )
    await assert.doesNotReject(() => agentLoopPlugin(pi))

    assert.ok(tools.some((tool) => tool.name === 'loop_control'))
    assert.ok(commands.loop)
    assert.ok(commands['loop-stop'])
  })
})

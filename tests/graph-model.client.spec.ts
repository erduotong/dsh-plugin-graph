// @vitest-environment node
/**
 * Plugin-graph data assembly: pure builder over boot manifest + slot ledger.
 * Unit coverage for the model, not the renderer (component specs live with
 * the assembled page).
 */
import { describe, expect, it } from 'vitest'
import type { LiveSlotNode } from '@deepseek-ai/dsh-client-ui-slots'
import { buildPluginGraph, shortName } from '../src/client/graph-model.ts'
import type { BootGraphWire } from '../src/client/graph-model.ts'

function slot(name: string, registrants: string[], declaredBy?: string, children: LiveSlotNode[] = []): LiveSlotNode {
  return {
    name,
    kind: 'list',
    scope: 'root',
    occupants: registrants.map(registrant => ({ registrant, priority: 0, active: true })),
    ...declaredBy === undefined ? {} : { declaredBy },
    children,
  }
}

describe('shortName', () => {
  it('drops the npm scope and well-known prefixes', () => {
    expect(shortName('@deepseek-ai/dsh-client-ui-goal')).toBe('dsh-client-ui-goal')
    expect(shortName('@deepseek-ai/cordis')).toBe('cordis')
    expect(shortName('react')).toBe('react')
  })
})

describe('buildPluginGraph', () => {
  it('builds plugin nodes with inject edges and reverse dependents', () => {
    const wire: BootGraphWire = {
      entries: [
        { id: '@deepseek-ai/dsh-client-ui-layout', inject: ['@deepseek-ai/dsh-client-runtime', '@deepseek-ai/dsh-client-ui-slots'] },
        { id: '@deepseek-ai/dsh-client-runtime', inject: ['@deepseek-ai/dsh-client-ui-slots'] },
        { id: '@deepseek-ai/dsh-client-ui-slots', immediately: true },
      ],
    }
    const model = buildPluginGraph(wire, [])
    expect(model.hasBoot).toBe(true)
    expect(model.plugins.map(plugin => plugin.id)).toEqual([
      '@deepseek-ai/dsh-client-runtime',
      '@deepseek-ai/dsh-client-ui-layout',
      '@deepseek-ai/dsh-client-ui-slots',
    ])
    const layout = model.plugins.find(plugin => plugin.id === '@deepseek-ai/dsh-client-ui-layout')
    expect(layout?.dependencies).toEqual(['@deepseek-ai/dsh-client-runtime', '@deepseek-ai/dsh-client-ui-slots'])
    expect(layout?.dependents).toEqual([])
    const runtime = model.plugins.find(plugin => plugin.id === '@deepseek-ai/dsh-client-runtime')
    expect(runtime?.dependents).toEqual(['@deepseek-ai/dsh-client-ui-layout'])
    expect(model.edges).toEqual([
      { from: '@deepseek-ai/dsh-client-runtime', to: '@deepseek-ai/dsh-client-ui-slots' },
      { from: '@deepseek-ai/dsh-client-ui-layout', to: '@deepseek-ai/dsh-client-runtime' },
      { from: '@deepseek-ai/dsh-client-ui-layout', to: '@deepseek-ai/dsh-client-ui-slots' },
    ])
  })

  it('records the prefetch mark from the boot entry', () => {
    const wire: BootGraphWire = {
      entries: [
        { id: 'a', immediately: true },
        { id: 'b' },
      ],
    }
    const model = buildPluginGraph(wire, [])
    expect(model.plugins.find(plugin => plugin.id === 'a')?.immediately).toBe(true)
    expect(model.plugins.find(plugin => plugin.id === 'b')?.immediately).toBe(false)
  })

  it('flattens the slot tree and stamps registrants and declaredBy', () => {
    const tree: LiveSlotNode[] = [
      slot('root', [], undefined, [
        slot('sidebar', ['@deepseek-ai/dsh-client-ui-sidebar'], '@deepseek-ai/dsh-client-ui-layout', [
          slot('sidebar.workspaces', ['@deepseek-ai/dsh-client-ui-workspace'], '@deepseek-ai/dsh-client-ui-sidebar'),
          slot('sidebar.settings', ['@deepseek-ai/dsh-client-ui-settings'], '@deepseek-ai/dsh-client-ui-sidebar'),
        ]),
        slot('settings.section', ['@deepseek-ai/dsh-client-ui-settings-plugins'], '@deepseek-ai/dsh-client-ui-settings', []),
      ]),
    ]
    const model = buildPluginGraph(undefined, tree)
    expect(model.slots.map(entry => entry.name)).toEqual([
      'root', 'sidebar', 'sidebar.workspaces', 'sidebar.settings', 'settings.section',
    ])
    const sidebar = model.slots.find(entry => entry.name === 'sidebar')
    expect(sidebar?.declaredBy).toBe('@deepseek-ai/dsh-client-ui-layout')
    expect(sidebar?.registrants).toEqual(['@deepseek-ai/dsh-client-ui-sidebar'])
    const section = model.slots.find(entry => entry.name === 'settings.section')
    expect(section?.registrants).toEqual(['@deepseek-ai/dsh-client-ui-settings-plugins'])
    // Slot registrants join the plugin set with source 'slot'.
    const layout = model.plugins.find(plugin => plugin.id === '@deepseek-ai/dsh-client-ui-layout')
    expect(layout?.source).toBe('slot')
  })

  it('merges boot and slot sources into both and deduplicates registrants', () => {
    const wire: BootGraphWire = { entries: [{ id: '@deepseek-ai/dsh-client-ui-layout', inject: ['@deepseek-ai/dsh-client-ui-slots'] }] }
    const tree: LiveSlotNode[] = [
      slot('root', [], undefined, [
        slot('sidebar', ['@deepseek-ai/dsh-client-ui-layout'], '@deepseek-ai/dsh-client-ui-layout'),
      ]),
    ]
    const model = buildPluginGraph(wire, tree)
    const layout = model.plugins.find(plugin => plugin.id === '@deepseek-ai/dsh-client-ui-layout')
    expect(layout?.source).toBe('both')
    const slotsRow = model.slots.find(entry => entry.name === 'sidebar')
    expect(slotsRow?.registrants).toEqual(['@deepseek-ai/dsh-client-ui-layout'])
  })

  it('reports hasBoot false and empty rows for missing inputs', () => {
    const model = buildPluginGraph(undefined, [])
    expect(model.hasBoot).toBe(false)
    expect(model.plugins).toEqual([])
    expect(model.edges).toEqual([])
    expect(model.slots).toEqual([])
  })
})

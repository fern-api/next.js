/**
 * MIT License
 *
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

// This file is copied from the Metro JavaScript bundler, with minor tweaks for
// webpack 4 compatibility.
//
// https://github.com/facebook/metro/blob/d6b9685c730d0d63577db40f41369157f28dfa3a/packages/metro/src/lib/polyfills/require.js

import RefreshRuntime from 'react-refresh/runtime'

type ModuleHotStatus =
  | 'idle'
  | 'check'
  | 'prepare'
  | 'ready'
  | 'dispose'
  | 'apply'
  | 'abort'
  | 'fail'

type ModuleHotStatusHandler = (status: ModuleHotStatus) => void

declare const module: {
  hot: {
    status: () => ModuleHotStatus
    addStatusHandler: (handler: ModuleHotStatusHandler) => void
    removeStatusHandler: (handler: ModuleHotStatusHandler) => void
  }
}

function isSafeExport(key: string): boolean {
  return (
    key === '__esModule' ||
    key === '__N_SSG' ||
    key === '__N_SSP' ||
    // TODO: remove this key from page config instead of allow listing it
    key === 'config'
  )
}

function registerExportsForReactRefresh(
  moduleExports: unknown,
  moduleID: string
) {
  if (moduleExports == null || typeof moduleExports !== 'object') {
    // Exit if we can't iterate over exports.
    // (This is important for legacy environments.)
    return
  }

  if (isClassComponent(moduleExports)) {
    RefreshRuntime.register(moduleExports, moduleID + ' ' + moduleExports.name)
  }

  for (var key in moduleExports) {
    if (isSafeExport(key)) {
      continue
    }
    try {
      var exportValue = moduleExports[key]
    } catch {
      // This might fail due to circular dependencies
      continue
    }

    if (isClassComponent(exportValue)) {
      var typeID = moduleID + ' ' + exportValue.name
      RefreshRuntime.register(exportValue, typeID)
    }
  }
}

function isClassComponent(component: unknown): component is Function {
  return (
    typeof component === 'function' &&
    typeof component.prototype === 'object' &&
    component.prototype !== null &&
    component.prototype.isReactComponent
  )
}

function getRefreshBoundarySignature(moduleExports: unknown): Array<unknown> {
  var signature = []
  signature.push(RefreshRuntime.getFamilyByType(moduleExports))
  if (moduleExports == null || typeof moduleExports !== 'object') {
    // Exit if we can't iterate over exports.
    // (This is important for legacy environments.)
    return signature
  }
  for (var key in moduleExports) {
    if (isSafeExport(key)) {
      continue
    }
    try {
      var exportValue = moduleExports[key]
    } catch {
      // This might fail due to circular dependencies
      continue
    }
    signature.push(key)
    signature.push(RefreshRuntime.getFamilyByType(exportValue))
  }
  return signature
}

function isReactRefreshBoundary(moduleExports: unknown): boolean {
  if (RefreshRuntime.isLikelyComponentType(moduleExports)) {
    return true
  }
  if (moduleExports == null || typeof moduleExports !== 'object') {
    // Exit if we can't iterate over exports.
    return false
  }
  var hasExports = false
  var areAllExportsComponents = true
  for (var key in moduleExports) {
    hasExports = true
    if (isSafeExport(key)) {
      continue
    }
    try {
      var exportValue = moduleExports[key]
    } catch {
      // This might fail due to circular dependencies
      return false
    }
    if (!RefreshRuntime.isLikelyComponentType(exportValue)) {
      areAllExportsComponents = false
    }
  }
  return hasExports && areAllExportsComponents
}

function shouldInvalidateReactRefreshBoundary(
  prevSignature: unknown[],
  nextSignature: unknown[]
): boolean {
  if (prevSignature.length !== nextSignature.length) {
    return true
  }
  for (var i = 0; i < nextSignature.length; i++) {
    if (prevSignature[i] !== nextSignature[i]) {
      return true
    }
  }
  return false
}

var isUpdateScheduled: boolean = false
// This function aggregates updates from multiple modules into a single React Refresh call.
function scheduleUpdate() {
  if (isUpdateScheduled) {
    return
  }
  isUpdateScheduled = true

  function canApplyUpdate(status: ModuleHotStatus) {
    return status === 'idle'
  }

  function applyUpdate() {
    isUpdateScheduled = false
    try {
      RefreshRuntime.performReactRefresh()
    } catch (err) {
      console.warn(
        'Warning: Failed to re-render. We will retry on the next Fast Refresh event.\n' +
          err
      )
    }
  }

  if (canApplyUpdate(module.hot.status())) {
    // Apply update on the next tick.
    Promise.resolve().then(() => {
      applyUpdate()
    })
    return
  }

  const statusHandler = (status) => {
    if (canApplyUpdate(status)) {
      module.hot.removeStatusHandler(statusHandler)
      applyUpdate()
    }
  }

  // Apply update once the HMR runtime's status is idle.
  module.hot.addStatusHandler(statusHandler)
}

// Needs to be compatible with IE11
export default {
  registerExportsForReactRefresh: registerExportsForReactRefresh,
  isReactRefreshBoundary: isReactRefreshBoundary,
  shouldInvalidateReactRefreshBoundary: shouldInvalidateReactRefreshBoundary,
  getRefreshBoundarySignature: getRefreshBoundarySignature,
  scheduleUpdate: scheduleUpdate,
}

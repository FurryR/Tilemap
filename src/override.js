export class Override {
  constructor(runtime) {
    if (runtime.renderer.tilemapLoaded) return
    runtime.renderer.tilemapLoaded = true
    runtime.renderer._gandiShaderManager.syncShader._program = undefined
    const oldDrawThese = runtime.renderer._drawThese
    runtime.renderer._drawThese = function (
      drawables,
      drawMode,
      projection,
      opts = {}
    ) {
      // const canDrawTilemap =
      //   drawMode == 'default' &&
      //   projection == this._projection &&
      //   (!this.tilemapFirstRender || !runtime.gandi)
      const canDrawTilemap =
        drawMode == 'default' && projection == this._projection
      oldDrawThese.call(
        new Proxy(this, {
          get: (_, property) => {
            const res = Reflect.get(this, property)
            if (property === '_allDrawables') {
              return new Proxy(res, {
                get: (_, property) => {
                  const res2 = Reflect.get(res, property)
                  if (typeof res2 === 'object' && res2 !== null) {
                    let evaluatedResult
                    let isEnabledEffectsRead = false
                    return new Proxy(res2, {
                      get: (_, property) => {
                        if (property === 'skin') {
                          evaluatedResult =
                            evaluatedResult ??
                            (canDrawTilemap &&
                              res2.tilemapData &&
                              res2.tilemapData.skipDraw)
                          if (evaluatedResult) return
                        } else if (
                          property === 'enabledEffects' &&
                          !isEnabledEffectsRead
                        ) {
                          // 绘制tilemap
                          if (
                            canDrawTilemap &&
                            res2.tilemapData &&
                            res2.tilemapData.drawTilemaps
                          ) {
                            let enterRegion = false // 是否进入tilemap region
                            if (this._regionId !== 'tilemap') {
                              // region 不是tilemap
                              this._doExitDrawRegion() // 退出之前的region
                              this._regionId = 'tilemap' // 设置regionid
                              // 设置退出tilemap region操作
                              this._exitRegion =
                                res2.tilemapData.exitTilemapRegion
                              enterRegion = true
                            }
                            // 告诉tilemap是否是enterRegion以进行进入Region初始化操作
                            res2.tilemapData.drawTilemaps(enterRegion, opts)
                          }
                          isEnabledEffectsRead = true
                        }
                        return Reflect.get(res2, property)
                      }
                    })
                  }
                  return res2
                }
              })
            }
            return res
          }
        }),
        drawables,
        drawMode,
        projection,
        opts
      )
      // this.tilemapFirstRender = false
    }
    const oldDraw = runtime.renderer.draw
    runtime.renderer.draw = function () {
      // this.tilemapFirstRender gandi ide 雷神会绘制两次
      // this.tilemapFirstRender = true
      oldDraw.call(this)
    }
  }
}
